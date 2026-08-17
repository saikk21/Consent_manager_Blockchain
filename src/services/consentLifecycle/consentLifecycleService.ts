import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import type {
  CompanyId,
  ConsentAction,
  ConsentId,
  ConsentStatus,
  ExternalUserId,
  PolicyRef,
  PurposeCode,
  VersionNo,
} from "../../domain/consent/types.js";
import {
  actionToEventType,
  DomainError,
  nextStatusForAction,
} from "../../domain/consent/lifecycle.js";
import { computeEventHash } from "../../domain/consent/hashing.js";
import {
  getConsentByIdentityForUpdate,
  insertConsent,
  updateConsentCurrentState,
} from "../../persistence/repositories/consentRepository.js";
import { insertEvent } from "../../persistence/repositories/eventRepository.js";
import { insertConsentVersion } from "../../persistence/repositories/consentVersionRepository.js";
import { enqueueOutboxMessage } from "../../persistence/repositories/outboxRepository.js";
import {
  finalizeIdempotencyCompleted,
} from "../../persistence/repositories/idempotencyRepository.js";
import {
  computeRequestHash,
  reserveIdempotencyKey,
} from "../idempotency/idempotency.js";
import { z } from "zod";
import type { WebhookEventService } from "../webhooks/webhookEventService.js";

export type RecordConsentCommand = Readonly<{
  companyId: CompanyId;
  idempotencyKey: string;
  externalUserId: ExternalUserId;
  purposeCode: PurposeCode;
  action: ConsentAction;
  policyRef: PolicyRef;
  occurredAt: string; // ISO
}>;

export type RecordConsentResult = Readonly<{
  consentId: ConsentId;
  eventId: string;
  versionNo: VersionNo;
  currentStatus: ConsentStatus;
  proofStatus: "PENDING";
}>;

const RecordConsentResultSchema = z.object({
  consentId: z.string().uuid(),
  eventId: z.string().uuid(),
  versionNo: z.number().int().positive(),
  currentStatus: z.enum(["NONE", "GRANTED", "REVOKED"]),
  proofStatus: z.literal("PENDING"),
});

export class ConsentLifecycleService {
  constructor(
    private readonly pool: DbPool,
    private readonly webhookEvent?: WebhookEventService,
  ) {}

  async recordConsent(cmd: RecordConsentCommand): Promise<RecordConsentResult> {
    const now = new Date();

    const requestHash = computeRequestHash({
      externalUserId: cmd.externalUserId,
      purposeCode: cmd.purposeCode,
      action: cmd.action,
      policyRef: cmd.policyRef,
      occurredAt: cmd.occurredAt,
    });

    const result = await withTx(this.pool, async (client) => {
      const reserve = await reserveIdempotencyKey(client, {
        companyId: cmd.companyId,
        idempotencyKey: cmd.idempotencyKey,
        requestHash,
        ttlSeconds: 60 * 60 * 24,
        now,
      });

      if (reserve.kind === "REPLAY") {
        const body = RecordConsentResultSchema.safeParse(reserve.row.response_body);
        if (!body.success) {
          // Should not happen, but keep behavior safe.
          throw new DomainError(
            "VALIDATION_ERROR",
            "Stored idempotency response is missing.",
          );
        }
        return body.data;
      }

      if (reserve.kind === "IN_PROGRESS") {
        throw new DomainError(
          "VALIDATION_ERROR",
          "Request with this Idempotency-Key is still in progress. Retry later.",
          { idempotencyKey: cmd.idempotencyKey },
        );
      }

      let consent =
        (await getConsentByIdentityForUpdate(client, {
          companyId: cmd.companyId,
          externalUserId: cmd.externalUserId,
          purposeCode: cmd.purposeCode,
        })) ?? null;

      if (!consent) {
        if (cmd.action !== "GRANT") {
          throw new DomainError(
            "CONSENT_NOT_FOUND",
            "Consent timeline not found for update/revoke.",
          );
        }
        consent = await insertConsent(client, {
          companyId: cmd.companyId,
          externalUserId: cmd.externalUserId,
          purposeCode: cmd.purposeCode,
        });
        // Lock it as well to preserve invariants for concurrent grant.
        consent =
          (await getConsentByIdentityForUpdate(client, {
            companyId: cmd.companyId,
            externalUserId: cmd.externalUserId,
            purposeCode: cmd.purposeCode,
          })) ?? consent;
      }

      const currentStatus = consent.current_status;
      const nextStatus = nextStatusForAction(currentStatus, cmd.action);
      const nextVersionNo = (consent.current_version_no + 1) as VersionNo;

      const eventType = actionToEventType(cmd.action);
      const recordedAt = new Date().toISOString();
      const eventHash = computeEventHash({
        companyId: cmd.companyId,
        consentId: consent.id,
        externalUserId: cmd.externalUserId,
        purposeCode: cmd.purposeCode,
        eventType,
        versionNo: nextVersionNo,
        policyRef: cmd.policyRef,
        occurredAt: cmd.occurredAt,
        recordedAt,
      });

      const event = await insertEvent(client, {
        companyId: cmd.companyId,
        consentId: consent.id,
        eventType,
        versionNo: nextVersionNo,
        eventHash,
      });

      await insertConsentVersion(client, {
        consentId: consent.id,
        versionNo: nextVersionNo,
        action: cmd.action,
        policyRef: cmd.policyRef,
        occurredAt: cmd.occurredAt,
        eventId: event.id,
      });

      await updateConsentCurrentState(client, {
        consentId: consent.id,
        currentVersionNo: nextVersionNo,
        currentStatus: nextStatus,
      });

      await enqueueOutboxMessage(client, {
        topic: "proof.pending",
        aggregateType: "EVENT",
        aggregateId: event.id,
        payload: {
          companyId: cmd.companyId,
          eventId: event.id,
        },
      });

      const result: RecordConsentResult = {
        consentId: consent.id,
        eventId: event.id,
        versionNo: nextVersionNo,
        currentStatus: nextStatus,
        proofStatus: "PENDING",
      };

      await finalizeIdempotencyCompleted(client, {
        companyId: cmd.companyId,
        idempotencyKey: cmd.idempotencyKey,
        responseCode: 200,
        responseBody: result,
        consentId: consent.id,
        eventId: event.id,
      });

      return result;
    });

    await this.webhookEvent?.enqueueEvent(cmd.companyId, "consent.recorded", {
      consent_id: result.consentId,
      event_id: result.eventId,
      version_no: result.versionNo,
      current_status: result.currentStatus,
      purpose_code: cmd.purposeCode,
      policy_ref: cmd.policyRef,
      action: cmd.action,
    });
    return result;
  }
}


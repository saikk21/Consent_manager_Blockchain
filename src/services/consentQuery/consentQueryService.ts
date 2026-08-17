import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  getConsentByIdentity,
  type ConsentRow,
} from "../../persistence/repositories/consentRepository.js";
import { listConsentTimeline } from "../../persistence/repositories/consentVersionRepository.js";

export type ConsentStatusResult = Readonly<{
  consentId: string;
  externalUserId: string;
  purposeCode: string;
  currentVersionNo: number;
  currentStatus: string;
  updatedAt: string;
}>;

export type ConsentTimelineResult = Readonly<{
  consentId: string;
  externalUserId: string;
  purposeCode: string;
  items: Array<{
    versionNo: number;
    action: string;
    policyRef: string;
    occurredAt: string;
    recordedAt: string;
    eventId: string;
    eventType: string;
    eventHash: string;
    proofStatus: string;
  }>;
  page: {
    limit: number;
    nextCursor: number | null;
    hasMore: boolean;
  };
}>;

function mapStatus(consent: ConsentRow): ConsentStatusResult {
  return {
    consentId: consent.id,
    externalUserId: consent.external_user_id,
    purposeCode: consent.purpose_code,
    currentVersionNo: consent.current_version_no,
    currentStatus: consent.current_status,
    updatedAt: consent.updated_at,
  };
}

export class ConsentQueryService {
  constructor(private readonly pool: DbPool) {}

  async getStatus(input: Readonly<{
    companyId: string;
    externalUserId: string;
    purposeCode: string;
  }>): Promise<ConsentStatusResult | null> {
    return withTx(this.pool, async (client) => {
      const consent = await getConsentByIdentity(client, input);
      if (!consent) return null;
      return mapStatus(consent);
    });
  }

  async getTimeline(input: Readonly<{
    companyId: string;
    externalUserId: string;
    purposeCode: string;
    cursorVersionNo: number;
    limit: number;
  }>): Promise<ConsentTimelineResult | null> {
    return withTx(this.pool, async (client) => {
      const consent = await getConsentByIdentity(client, {
        companyId: input.companyId,
        externalUserId: input.externalUserId,
        purposeCode: input.purposeCode,
      });
      if (!consent) return null;

      const rows = await listConsentTimeline(client, {
        consentId: consent.id,
        cursorVersionNo: input.cursorVersionNo,
        limit: input.limit + 1,
      });

      const hasMore = rows.length > input.limit;
      const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.version_no ?? null : null;

      return {
        consentId: consent.id,
        externalUserId: consent.external_user_id,
        purposeCode: consent.purpose_code,
        items: pageRows.map((r) => ({
          versionNo: r.version_no,
          action: r.action,
          policyRef: r.policy_ref,
          occurredAt: r.occurred_at,
          recordedAt: r.recorded_at,
          eventId: r.event_id,
          eventType: r.event_type,
          eventHash: r.event_hash,
          proofStatus: r.proof_status,
        })),
        page: {
          limit: input.limit,
          nextCursor,
          hasMore,
        },
      };
    });
  }
}


import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import { getPolicyArtifact } from "../../persistence/repositories/policyRepository.js";
import {
  getWidgetSession,
  getWidgetSessionForUpdate,
  insertWidgetSession,
  markWidgetSessionConsumed,
  updateWidgetSessionState,
} from "../../persistence/repositories/widgetSessionRepository.js";
import {
  createWidgetSessionNonce,
  generateWidgetSessionToken,
  verifyWidgetSessionToken,
  type WidgetSessionClaims,
} from "../../security/widgetSessionToken.js";
import { computeRenderHash } from "../../domain/policy/hashing.js";
import { ConsentLifecycleService } from "../consentLifecycle/consentLifecycleService.js";
import { loadEnv } from "../../config/env.js";
import type { WebhookEventService } from "../webhooks/webhookEventService.js";

const CreateWidgetSessionBody = z.object({
  external_user_id: z.string().min(1).max(200),
  purpose_code: z.string().min(1).max(100),
  policy_ref: z.string().min(1).max(200),
  policy_version: z.number().int().positive(),
  locale: z.string().min(2).max(20),
  allowed_origin: z.string().url(),
  environment: z.string().default("dev"),
  ttl_seconds: z.number().int().positive().max(3600).default(600),
});

const SubmitWidgetBody = z.object({
  session_token: z.string().min(20),
  action: z.enum(["GRANT", "UPDATE", "REVOKE"]),
  occurred_at: z.string().datetime(),
});

export class WidgetSessionService {
  constructor(
    private readonly pool: DbPool,
    private readonly consentLifecycle: ConsentLifecycleService,
    private readonly webhookEvent?: WebhookEventService,
  ) {}

  async createSession(companyId: string, body: unknown) {
    const parsed = CreateWidgetSessionBody.parse(body);
    const env = loadEnv();
    const signingKid = env.WIDGET_SESSION_SIGNING_KID;
    const sessionId = randomUUID();
    const nonce = createWidgetSessionNonce();
    const expiresAt = new Date(Date.now() + parsed.ttl_seconds * 1000).toISOString();

    const response = await withTx(this.pool, async (client) => {
      const policy = await getPolicyArtifact(client, {
        companyId,
        policyRef: parsed.policy_ref,
        version: parsed.policy_version,
      });
      if (!policy) throw new Error("Policy version not found.");
      if (policy.state !== "PUBLISHED") throw new Error("Policy version must be PUBLISHED.");

      const locales = policy.locales as Record<string, unknown>;
      if (!(parsed.locale in locales)) throw new Error("Requested locale is not available in policy.");

      const renderHash = computeRenderHash({
        policyContentHash: policy.policy_content_hash,
        locale: parsed.locale,
        requiredLegalVersion: policy.required_legal_version,
        uiSchemaVersion: policy.ui_schema_version,
      });

      const session = await insertWidgetSession(client, {
        id: sessionId,
        companyId,
        environment: parsed.environment,
        externalUserId: parsed.external_user_id,
        purposeCode: parsed.purpose_code,
        policyRef: parsed.policy_ref,
        policyVersion: parsed.policy_version,
        locale: parsed.locale,
        allowedOrigin: parsed.allowed_origin,
        renderHash,
        nonce,
        signingKid,
        expiresAt,
      });

      const claims: WidgetSessionClaims = {
        iss: "sammati",
        aud: "sammati-widget",
        jti: session.id,
        company_id: session.company_id,
        environment: session.environment,
        external_user_id: session.external_user_id,
        purpose_code: session.purpose_code,
        policy_ref: session.policy_ref,
        policy_version: session.policy_version,
        locale: session.locale,
        allowed_origin: session.allowed_origin,
        render_hash: session.render_hash,
        nonce: session.nonce,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(new Date(session.expires_at).getTime() / 1000),
      };
      const token = generateWidgetSessionToken(claims);

      return {
        sessionId: session.id,
        expiresAt: session.expires_at,
        render: {
          renderHash: session.render_hash,
          uiSchemaVersion: policy.ui_schema_version,
        },
        token: {
          sessionToken: token,
        },
      };
    });
    await this.webhookEvent?.enqueueEvent(companyId, "widget.session.created", {
      session_id: response.sessionId,
      purpose_code: parsed.purpose_code,
      policy_ref: parsed.policy_ref,
      policy_version: parsed.policy_version,
    });
    return response;
  }

  async getSession(companyId: string, sessionId: string) {
    return withTx(this.pool, async (client) => {
      const row = await getWidgetSession(client, { sessionId });
      if (!row || row.company_id !== companyId) return null;
      return {
        sessionId: row.id,
        status: row.status,
        expiresAt: row.expires_at,
        consent: row.consent_event_id
          ? {
              consentId: row.consent_id,
              eventId: row.consent_event_id,
              versionNo: row.consent_version_no,
              currentStatus: row.current_status,
            }
          : null,
      };
    });
  }

  async expireSession(sessionId: string) {
    return withTx(this.pool, async (client) => {
      const row = await getWidgetSessionForUpdate(client, { sessionId });
      if (!row) return null;
      if (row.status === "ISSUED" || row.status === "STARTED") {
        await updateWidgetSessionState(client, { sessionId, state: "EXPIRED" });
      }
      return true;
    });
  }

  async cancelSession(sessionId: string) {
    return withTx(this.pool, async (client) => {
      const row = await getWidgetSessionForUpdate(client, { sessionId });
      if (!row) return null;
      if (row.status === "ISSUED" || row.status === "STARTED") {
        await updateWidgetSessionState(client, { sessionId, state: "CANCELLED" });
      }
      return true;
    });
  }

  async submitSession(sessionId: string, body: unknown, originHeader: string | undefined) {
    const parsed = SubmitWidgetBody.parse(body);
    const claims = verifyWidgetSessionToken(parsed.session_token);

    if (claims.jti !== sessionId) throw new Error("Session token does not match session id.");
    if (!originHeader || originHeader !== claims.allowed_origin) {
      throw new Error("Invalid origin for widget session submit.");
    }

    const locked = await withTx(this.pool, async (client) => {
      const row = await getWidgetSessionForUpdate(client, { sessionId });
      if (!row) throw new Error("Widget session not found.");

      if (row.company_id !== claims.company_id) throw new Error("Token/company mismatch.");
      if (row.nonce !== claims.nonce) throw new Error("Token nonce mismatch.");

      if (row.status === "CONSUMED") throw new Error("Widget session already consumed.");
      if (row.status === "CANCELLED") throw new Error("Widget session cancelled.");

      const expired = new Date(row.expires_at).getTime() <= Date.now();
      if (expired || row.status === "EXPIRED") {
        await updateWidgetSessionState(client, {
          sessionId,
          state: "EXPIRED",
          failureReason: "Session expired.",
        });
        throw new Error("Widget session expired.");
      }

      if (row.status === "ISSUED") {
        await updateWidgetSessionState(client, { sessionId, state: "STARTED" });
      }
      return row;
    });

    const idempotencyKey = `widget-submit-${sessionId}`;
    const result = await this.consentLifecycle.recordConsent({
      companyId: locked.company_id,
      idempotencyKey,
      externalUserId: locked.external_user_id,
      purposeCode: locked.purpose_code,
      action: parsed.action,
      policyRef: `${locked.policy_ref}@v${locked.policy_version}`,
      occurredAt: parsed.occurred_at,
    });

    await withTx(this.pool, async (client) => {
      await markWidgetSessionConsumed(client, {
        sessionId,
        idempotencyKey,
        consentId: result.consentId,
        consentEventId: result.eventId,
        consentVersionNo: result.versionNo,
        currentStatus: result.currentStatus,
      });
    });
    await this.webhookEvent?.enqueueEvent(locked.company_id, "widget.session.consumed", {
      session_id: sessionId,
      consent_id: result.consentId,
      event_id: result.eventId,
      version_no: result.versionNo,
      current_status: result.currentStatus,
    });

    return result;
  }
}


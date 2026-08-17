import { z } from "zod";
import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import { getPolicyArtifact } from "../../persistence/repositories/policyRepository.js";
import {
  getWidgetSessionForUpdate,
  updateWidgetSessionState,
} from "../../persistence/repositories/widgetSessionRepository.js";
import { verifyWidgetSessionToken } from "../../security/widgetSessionToken.js";
import { computeRenderHash } from "../../domain/policy/hashing.js";
import { orderPolicySectionsForWidgetRuntime } from "../../domain/policy/widgetSectionOrder.js";
import { WIDGET_MESSAGE_VERSION } from "@sammati/shared-core";
import {
  WidgetRuntimeBootstrapResponseSchema,
  WidgetRuntimeBootstrapSchema,
  type WidgetRuntimeBootstrapResponse,
} from "./widgetRuntimeContract.js";

const RuntimeSectionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const RuntimeLocaleSchema = z.object({
  title: z.string(),
  sections: z.array(RuntimeSectionSchema).min(1),
});

export class WidgetRuntimeService {
  constructor(private readonly pool: DbPool) {}

  async bootstrap(input: unknown): Promise<WidgetRuntimeBootstrapResponse> {
    const parsed = WidgetRuntimeBootstrapSchema.parse(input);
    const claims = verifyWidgetSessionToken(parsed.session_token, { allowExpired: true });

    if (parsed.parent_origin && parsed.parent_origin !== claims.allowed_origin) {
      throw new Error("Parent origin is not allowed for this session.");
    }

    const response = await withTx(this.pool, async (client) => {
      const session = await getWidgetSessionForUpdate(client, { sessionId: claims.jti });
      if (!session) throw new Error("Widget session not found.");
      if (session.company_id !== claims.company_id) throw new Error("Token/company mismatch.");
      if (session.nonce !== claims.nonce) throw new Error("Token nonce mismatch.");
      if (session.render_hash !== claims.render_hash) throw new Error("Render hash mismatch.");

      let effectiveStatus = session.status;
      const nowMs = Date.now();
      const expired = new Date(session.expires_at).getTime() <= nowMs || effectiveStatus === "EXPIRED";
      if (expired && (effectiveStatus === "ISSUED" || effectiveStatus === "STARTED")) {
        await updateWidgetSessionState(client, {
          sessionId: session.id,
          state: "EXPIRED",
          failureReason: "Session expired.",
        });
        effectiveStatus = "EXPIRED";
      }

      const policy = await getPolicyArtifact(client, {
        companyId: session.company_id,
        policyRef: session.policy_ref,
        version: session.policy_version,
      });
      if (!policy || policy.state !== "PUBLISHED") {
        throw new Error("Policy artifact unavailable for widget runtime.");
      }

      const locales = policy.locales as Record<string, unknown>;
      const localeData = RuntimeLocaleSchema.parse(locales[session.locale]);
      const computedRenderHash = computeRenderHash({
        policyContentHash: policy.policy_content_hash,
        locale: session.locale,
        requiredLegalVersion: policy.required_legal_version,
        uiSchemaVersion: policy.ui_schema_version,
      });
      if (computedRenderHash !== session.render_hash) {
        throw new Error("Session render hash mismatch.");
      }

      const sections = orderPolicySectionsForWidgetRuntime(localeData);
      const stateReason =
        effectiveStatus === "CONSUMED"
          ? "Session already consumed."
          : effectiveStatus === "EXPIRED"
            ? "Session expired."
            : effectiveStatus === "CANCELLED"
              ? "Session cancelled."
              : undefined;

      return {
        version: WIDGET_MESSAGE_VERSION,
        session: {
          session_id: session.id,
          status: effectiveStatus,
          expires_at:
            typeof session.expires_at === "string"
              ? session.expires_at
              : new Date(session.expires_at).toISOString(),
          allowed_origin: session.allowed_origin,
          locale: session.locale,
          purpose_code: session.purpose_code,
          render_hash: session.render_hash,
          ...(stateReason ? { state_reason: stateReason } : {}),
        },
        policy: {
          policy_ref: session.policy_ref,
          policy_version: session.policy_version,
          title: localeData.title,
          required_legal_version: policy.required_legal_version,
          ui_schema_version: policy.ui_schema_version,
          sections,
        },
      };
    });

    return WidgetRuntimeBootstrapResponseSchema.parse(response);
  }
}


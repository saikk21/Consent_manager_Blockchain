import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  CreatePolicyDraftSchema,
  validateRequiredSections,
} from "../../domain/policy/validation.js";
import { computePolicyContentHash, computeRenderHash } from "../../domain/policy/hashing.js";
import {
  getPolicyArtifact,
  insertPolicyDraft,
  listPolicyVersions,
  publishPolicyArtifact,
} from "../../persistence/repositories/policyRepository.js";

export class PolicyService {
  constructor(private readonly pool: DbPool) {}

  async createDraft(companyId: string, input: unknown) {
    const parsed = CreatePolicyDraftSchema.parse(input);

    if (!(parsed.defaultLocale in parsed.locales)) {
      throw new Error("defaultLocale must exist in locales.");
    }
    validateRequiredSections(parsed.locales as any);

    const policyContentHash = computePolicyContentHash({
      companyId,
      policyRef: parsed.policyRef,
      version: parsed.version,
      defaultLocale: parsed.defaultLocale,
      requiredLegalVersion: parsed.requiredLegalVersion,
      locales: parsed.locales,
      uiSchemaVersion: parsed.uiSchemaVersion,
    });

    return withTx(this.pool, (client) =>
      insertPolicyDraft(client, {
        companyId,
        policyRef: parsed.policyRef,
        version: parsed.version,
        defaultLocale: parsed.defaultLocale,
        requiredLegalVersion: parsed.requiredLegalVersion,
        locales: parsed.locales,
        policyContentHash,
        uiSchemaVersion: parsed.uiSchemaVersion,
      }),
    );
  }

  async publish(companyId: string, policyRef: string, version: number) {
    return withTx(this.pool, async (client) => {
      const existing = await getPolicyArtifact(client, { companyId, policyRef, version });
      if (!existing) return null;
      if (existing.state !== "DRAFT") return existing; // idempotent publish

      // Validate determinism at publish time (re-hash and compare).
      const recomputed = computePolicyContentHash({
        companyId,
        policyRef,
        version,
        defaultLocale: existing.default_locale,
        requiredLegalVersion: existing.required_legal_version,
        locales: existing.locales,
        uiSchemaVersion: existing.ui_schema_version,
      });
      if (recomputed !== existing.policy_content_hash) {
        throw new Error("Policy content hash mismatch; policy content is not deterministic.");
      }

      const published = await publishPolicyArtifact(client, { companyId, policyRef, version });
      return published ?? existing;
    });
  }

  async getVersion(companyId: string, policyRef: string, version: number, locale?: string) {
    return withTx(this.pool, async (client) => {
      const row = await getPolicyArtifact(client, { companyId, policyRef, version });
      if (!row) return null;
      const chosenLocale = locale ?? row.default_locale;
      const renderHash = computeRenderHash({
        policyContentHash: row.policy_content_hash,
        locale: chosenLocale,
        requiredLegalVersion: row.required_legal_version,
        uiSchemaVersion: row.ui_schema_version,
      });
      return {
        ...row,
        locale: chosenLocale,
        render_hash: renderHash,
      };
    });
  }

  async listVersions(companyId: string, policyRef: string, cursorVersion: number, limit: number) {
    return withTx(this.pool, async (client) => {
      const rows = await listPolicyVersions(client, {
        companyId,
        policyRef,
        cursorVersion,
        limit: limit + 1,
      });
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1]!.version : null;
      return { items: page, page: { limit, nextCursor, hasMore } };
    });
  }
}


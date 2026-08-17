import type { DbClient } from "../db/pool.js";
import type { PolicyState } from "../../domain/policy/types.js";

export type PolicyArtifactRow = Readonly<{
  id: string;
  company_id: string;
  policy_ref: string;
  version: number;
  state: PolicyState;
  default_locale: string;
  required_legal_version: string;
  locales: unknown;
  policy_content_hash: string;
  ui_schema_version: number;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
  updated_at: string;
}>;

export async function insertPolicyDraft(
  client: DbClient,
  input: Readonly<{
    companyId: string;
    policyRef: string;
    version: number;
    defaultLocale: string;
    requiredLegalVersion: string;
    locales: unknown;
    policyContentHash: string;
    uiSchemaVersion: number;
  }>,
): Promise<PolicyArtifactRow> {
  const res = await client.query<PolicyArtifactRow>(
    `
    INSERT INTO policy_artifacts (
      company_id,
      policy_ref,
      version,
      state,
      default_locale,
      required_legal_version,
      locales,
      policy_content_hash,
      ui_schema_version
    )
    VALUES ($1,$2,$3,'DRAFT',$4,$5,$6::jsonb,$7,$8)
    RETURNING *
    `,
    [
      input.companyId,
      input.policyRef,
      input.version,
      input.defaultLocale,
      input.requiredLegalVersion,
      JSON.stringify(input.locales),
      input.policyContentHash,
      input.uiSchemaVersion,
    ],
  );
  return res.rows[0]!;
}

export async function getPolicyArtifact(
  client: DbClient,
  input: Readonly<{ companyId: string; policyRef: string; version: number }>,
): Promise<PolicyArtifactRow | null> {
  const res = await client.query<PolicyArtifactRow>(
    `
    SELECT *
    FROM policy_artifacts
    WHERE company_id = $1 AND policy_ref = $2 AND version = $3
    `,
    [input.companyId, input.policyRef, input.version],
  );
  return res.rows[0] ?? null;
}

export async function publishPolicyArtifact(
  client: DbClient,
  input: Readonly<{ companyId: string; policyRef: string; version: number }>,
): Promise<PolicyArtifactRow | null> {
  const res = await client.query<PolicyArtifactRow>(
    `
    UPDATE policy_artifacts
    SET state = 'PUBLISHED',
        published_at = now(),
        updated_at = now()
    WHERE company_id = $1
      AND policy_ref = $2
      AND version = $3
      AND state = 'DRAFT'
    RETURNING *
    `,
    [input.companyId, input.policyRef, input.version],
  );
  return res.rows[0] ?? null;
}

export async function listPolicyVersions(
  client: DbClient,
  input: Readonly<{ companyId: string; policyRef: string; cursorVersion: number; limit: number }>,
): Promise<PolicyArtifactRow[]> {
  const res = await client.query<PolicyArtifactRow>(
    `
    SELECT *
    FROM policy_artifacts
    WHERE company_id = $1
      AND policy_ref = $2
      AND version > $3
    ORDER BY version ASC
    LIMIT $4
    `,
    [input.companyId, input.policyRef, input.cursorVersion, input.limit],
  );
  return res.rows;
}


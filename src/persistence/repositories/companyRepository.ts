import type { DbClient } from "../db/pool.js";

export type CompanyRow = Readonly<{
  id: string;
  name: string;
  created_at: string;
}>;

export type CompanyApiKeyRow = Readonly<{
  id: string;
  company_id: string;
  key_prefix: string;
  key_hash: string;
  status: "ACTIVE" | "REVOKED";
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}>;

export async function getCompanyById(
  client: DbClient,
  input: Readonly<{ companyId: string }>,
): Promise<CompanyRow | null> {
  const res = await client.query<CompanyRow>(
    `
    SELECT id, name, created_at
    FROM companies
    WHERE id = $1
    `,
    [input.companyId],
  );
  return res.rows[0] ?? null;
}

export async function insertCompany(
  client: DbClient,
  input: Readonly<{ name: string }>,
): Promise<CompanyRow> {
  const res = await client.query<CompanyRow>(
    `
    INSERT INTO companies (name)
    VALUES ($1)
    RETURNING id, name, created_at
    `,
    [input.name],
  );
  return res.rows[0]!;
}

export async function getCompanyByApiKeyHash(
  client: DbClient,
  input: Readonly<{ apiKeyHash: string }>,
): Promise<CompanyRow | null> {
  const res = await client.query<CompanyRow>(
    `
    SELECT c.id, c.name, c.created_at
    FROM companies c
    INNER JOIN company_api_keys k ON k.company_id = c.id
    WHERE k.key_hash = $1
      AND k.status = 'ACTIVE'
      AND k.revoked_at IS NULL
    LIMIT 1
    `,
    [input.apiKeyHash],
  );
  return res.rows[0] ?? null;
}

export async function insertCompanyApiKey(
  client: DbClient,
  input: Readonly<{
    companyId: string;
    keyPrefix: string;
    keyHash: string;
  }>,
): Promise<CompanyApiKeyRow> {
  const res = await client.query<CompanyApiKeyRow>(
    `
    INSERT INTO company_api_keys (
      company_id,
      key_prefix,
      key_hash,
      status
    )
    VALUES ($1, $2, $3, 'ACTIVE')
    RETURNING
      id,
      company_id,
      key_prefix,
      key_hash,
      status,
      created_at,
      revoked_at,
      last_used_at
    `,
    [input.companyId, input.keyPrefix, input.keyHash],
  );
  return res.rows[0]!;
}

export async function touchApiKeyLastUsedAt(
  client: DbClient,
  input: Readonly<{ apiKeyHash: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE company_api_keys
    SET last_used_at = now()
    WHERE key_hash = $1
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
    `,
    [input.apiKeyHash],
  );
}


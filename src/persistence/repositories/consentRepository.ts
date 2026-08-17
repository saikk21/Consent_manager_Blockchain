import type { DbClient } from "../db/pool.js";
import type {
  CompanyId,
  ConsentId,
  ConsentStatus,
  ExternalUserId,
  PurposeCode,
  VersionNo,
} from "../../domain/consent/types.js";

export type ConsentRow = Readonly<{
  id: ConsentId;
  company_id: CompanyId;
  external_user_id: ExternalUserId;
  purpose_code: PurposeCode;
  current_version_no: VersionNo;
  current_status: ConsentStatus;
  created_at: string;
  updated_at: string;
}>;

export async function getConsentByIdentityForUpdate(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    externalUserId: ExternalUserId;
    purposeCode: PurposeCode;
  }>,
): Promise<ConsentRow | null> {
  const res = await client.query<ConsentRow>(
    `
    SELECT
      id,
      company_id,
      external_user_id,
      purpose_code,
      current_version_no,
      current_status,
      created_at,
      updated_at
    FROM consents
    WHERE company_id = $1 AND external_user_id = $2 AND purpose_code = $3
    FOR UPDATE
    `,
    [input.companyId, input.externalUserId, input.purposeCode],
  );
  return res.rows[0] ?? null;
}

export async function getConsentByIdentity(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    externalUserId: ExternalUserId;
    purposeCode: PurposeCode;
  }>,
): Promise<ConsentRow | null> {
  const res = await client.query<ConsentRow>(
    `
    SELECT
      id,
      company_id,
      external_user_id,
      purpose_code,
      current_version_no,
      current_status,
      created_at,
      updated_at
    FROM consents
    WHERE company_id = $1 AND external_user_id = $2 AND purpose_code = $3
    `,
    [input.companyId, input.externalUserId, input.purposeCode],
  );
  return res.rows[0] ?? null;
}

export async function getConsentById(
  client: DbClient,
  input: Readonly<{ consentId: string; companyId: string }>,
): Promise<ConsentRow | null> {
  const res = await client.query<ConsentRow>(
    `
    SELECT
      id,
      company_id,
      external_user_id,
      purpose_code,
      current_version_no,
      current_status,
      created_at,
      updated_at
    FROM consents
    WHERE id = $1
      AND company_id = $2
    `,
    [input.consentId, input.companyId],
  );
  return res.rows[0] ?? null;
}

export async function insertConsent(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    externalUserId: ExternalUserId;
    purposeCode: PurposeCode;
  }>,
): Promise<ConsentRow> {
  const inserted = await client.query<ConsentRow>(
    `
    INSERT INTO consents (
      company_id,
      external_user_id,
      purpose_code,
      current_version_no,
      current_status
    )
    VALUES ($1, $2, $3, 0, 'NONE')
    ON CONFLICT (company_id, external_user_id, purpose_code) DO NOTHING
    RETURNING
      id,
      company_id,
      external_user_id,
      purpose_code,
      current_version_no,
      current_status,
      created_at,
      updated_at
    `,
    [input.companyId, input.externalUserId, input.purposeCode],
  );
  if (inserted.rows[0]) return inserted.rows[0];

  // Another concurrent transaction may have created this row first.
  const existing = await getConsentByIdentityForUpdate(client, input);
  if (!existing) {
    throw new Error("Failed to create or load consent timeline.");
  }
  return existing;
}

export async function updateConsentCurrentState(
  client: DbClient,
  input: Readonly<{
    consentId: ConsentId;
    currentVersionNo: VersionNo;
    currentStatus: ConsentStatus;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE consents
    SET current_version_no = $2,
        current_status = $3,
        updated_at = now()
    WHERE id = $1
    `,
    [input.consentId, input.currentVersionNo, input.currentStatus],
  );
}


import type { DbClient } from "../db/pool.js";
import type { CompanyId, ConsentId, EventId } from "../../domain/consent/types.js";

export type IdempotencyStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type IdempotencyRow = Readonly<{
  id: string;
  company_id: CompanyId;
  idempotency_key: string;
  request_hash: string;
  status: IdempotencyStatus;
  response_code: number | null;
  response_body: unknown | null;
  consent_id: ConsentId | null;
  event_id: EventId | null;
  created_at: string;
  expires_at: string;
}>;

export async function getIdempotencyRowForUpdate(
  client: DbClient,
  input: Readonly<{ companyId: CompanyId; idempotencyKey: string }>,
): Promise<IdempotencyRow | null> {
  const res = await client.query<IdempotencyRow>(
    `
    SELECT
      id,
      company_id,
      idempotency_key,
      request_hash,
      status,
      response_code,
      response_body,
      consent_id,
      event_id,
      created_at,
      expires_at
    FROM idempotency_keys
    WHERE company_id = $1 AND idempotency_key = $2
    FOR UPDATE
    `,
    [input.companyId, input.idempotencyKey],
  );
  return res.rows[0] ?? null;
}

export async function insertIdempotencyInProgress(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: string; // ISO
  }>,
): Promise<IdempotencyRow> {
  const res = await client.query<IdempotencyRow>(
    `
    INSERT INTO idempotency_keys (
      company_id,
      idempotency_key,
      request_hash,
      status,
      expires_at
    )
    VALUES ($1, $2, $3, 'IN_PROGRESS', $4)
    RETURNING
      id,
      company_id,
      idempotency_key,
      request_hash,
      status,
      response_code,
      response_body,
      consent_id,
      event_id,
      created_at,
      expires_at
    `,
    [input.companyId, input.idempotencyKey, input.requestHash, input.expiresAt],
  );
  return res.rows[0]!;
}

export async function finalizeIdempotencyCompleted(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    idempotencyKey: string;
    responseCode: number;
    responseBody: unknown;
    consentId: ConsentId;
    eventId: EventId;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE idempotency_keys
    SET status = 'COMPLETED',
        response_code = $3,
        response_body = $4::jsonb,
        consent_id = $5,
        event_id = $6
    WHERE company_id = $1 AND idempotency_key = $2
    `,
    [
      input.companyId,
      input.idempotencyKey,
      input.responseCode,
      JSON.stringify(input.responseBody),
      input.consentId,
      input.eventId,
    ],
  );
}


import type { DbClient } from "../db/pool.js";
import type {
  CompanyId,
  ConsentEventType,
  ConsentId,
  EventId,
  VersionNo,
} from "../../domain/consent/types.js";

export type EventRow = Readonly<{
  id: EventId;
  company_id: CompanyId;
  consent_id: ConsentId;
  event_type: ConsentEventType;
  version_no: VersionNo;
  event_hash: string;
  recorded_at: string;
  proof_status: "PENDING" | "READY" | "FAILED";
  proof_batch_id: string | null;
}>;

export async function insertEvent(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    consentId: ConsentId;
    eventType: ConsentEventType;
    versionNo: VersionNo;
    eventHash: string;
  }>,
): Promise<EventRow> {
  const res = await client.query<EventRow>(
    `
    INSERT INTO events (
      company_id,
      consent_id,
      event_type,
      version_no,
      event_hash
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      company_id,
      consent_id,
      event_type,
      version_no,
      event_hash,
      recorded_at,
      proof_status,
      proof_batch_id
    `,
    [input.companyId, input.consentId, input.eventType, input.versionNo, input.eventHash],
  );
  return res.rows[0]!;
}

export async function listEventsForConsent(
  client: DbClient,
  input: Readonly<{
    consentId: ConsentId;
    afterVersionNo?: VersionNo;
    limit: number;
  }>,
): Promise<EventRow[]> {
  const res = await client.query<EventRow>(
    `
    SELECT
      id,
      company_id,
      consent_id,
      event_type,
      version_no,
      event_hash,
      recorded_at,
      proof_status,
      proof_batch_id
    FROM events
    WHERE consent_id = $1
      AND ($2::int IS NULL OR version_no > $2::int)
    ORDER BY version_no ASC
    LIMIT $3
    `,
    [input.consentId, input.afterVersionNo ?? null, input.limit],
  );
  return res.rows;
}


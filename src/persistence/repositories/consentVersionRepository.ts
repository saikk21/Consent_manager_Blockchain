import type { DbClient } from "../db/pool.js";
import type {
  ConsentAction,
  ConsentId,
  EventId,
  PolicyRef,
  VersionNo,
} from "../../domain/consent/types.js";

export type ConsentVersionRow = Readonly<{
  id: string;
  consent_id: ConsentId;
  version_no: VersionNo;
  action: ConsentAction;
  policy_ref: PolicyRef;
  occurred_at: string;
  recorded_at: string;
  event_id: EventId;
}>;

export type ConsentTimelineRow = Readonly<{
  version_no: VersionNo;
  action: ConsentAction;
  policy_ref: PolicyRef;
  occurred_at: string;
  recorded_at: string;
  event_id: EventId;
  event_type: string;
  event_hash: string;
  proof_status: string;
}>;

export async function insertConsentVersion(
  client: DbClient,
  input: Readonly<{
    consentId: ConsentId;
    versionNo: VersionNo;
    action: ConsentAction;
    policyRef: PolicyRef;
    occurredAt: string;
    eventId: EventId;
  }>,
): Promise<ConsentVersionRow> {
  const res = await client.query<ConsentVersionRow>(
    `
    INSERT INTO consent_versions (
      consent_id,
      version_no,
      action,
      policy_ref,
      occurred_at,
      event_id
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      consent_id,
      version_no,
      action,
      policy_ref,
      occurred_at,
      recorded_at,
      event_id
    `,
    [
      input.consentId,
      input.versionNo,
      input.action,
      input.policyRef,
      input.occurredAt,
      input.eventId,
    ],
  );
  return res.rows[0]!;
}

export async function listConsentTimeline(
  client: DbClient,
  input: Readonly<{
    consentId: ConsentId;
    cursorVersionNo: number;
    limit: number;
  }>,
): Promise<ConsentTimelineRow[]> {
  const res = await client.query<ConsentTimelineRow>(
    `
    SELECT
      cv.version_no,
      cv.action,
      cv.policy_ref,
      cv.occurred_at,
      cv.recorded_at,
      cv.event_id,
      e.event_type,
      e.event_hash,
      e.proof_status
    FROM consent_versions cv
    INNER JOIN events e ON e.id = cv.event_id
    WHERE cv.consent_id = $1
      AND cv.version_no > $2
    ORDER BY cv.version_no ASC
    LIMIT $3
    `,
    [input.consentId, input.cursorVersionNo, input.limit],
  );
  return res.rows;
}


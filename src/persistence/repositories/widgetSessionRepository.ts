import type { DbClient } from "../db/pool.js";

export type WidgetSessionState = "ISSUED" | "STARTED" | "CONSUMED" | "EXPIRED" | "CANCELLED";

export type WidgetSessionRow = Readonly<{
  id: string;
  company_id: string;
  environment: string;
  external_user_id: string;
  purpose_code: string;
  policy_ref: string;
  policy_version: number;
  locale: string;
  allowed_origin: string;
  render_hash: string;
  status: WidgetSessionState;
  nonce: string;
  signing_kid: string;
  issued_at: string;
  started_at: string | null;
  consumed_at: string | null;
  expires_at: string;
  cancelled_at: string | null;
  idempotency_key: string | null;
  consent_id: string | null;
  consent_event_id: string | null;
  consent_version_no: number | null;
  current_status: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}>;

export async function insertWidgetSession(
  client: DbClient,
  input: Readonly<{
    id: string;
    companyId: string;
    environment: string;
    externalUserId: string;
    purposeCode: string;
    policyRef: string;
    policyVersion: number;
    locale: string;
    allowedOrigin: string;
    renderHash: string;
    nonce: string;
    signingKid: string;
    expiresAt: string;
  }>,
): Promise<WidgetSessionRow> {
  const res = await client.query<WidgetSessionRow>(
    `
    INSERT INTO widget_sessions (
      id, company_id, environment, external_user_id, purpose_code, policy_ref, policy_version,
      locale, allowed_origin, render_hash, status, nonce, signing_kid, expires_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ISSUED',$11,$12,$13)
    RETURNING *
    `,
    [
      input.id,
      input.companyId,
      input.environment,
      input.externalUserId,
      input.purposeCode,
      input.policyRef,
      input.policyVersion,
      input.locale,
      input.allowedOrigin,
      input.renderHash,
      input.nonce,
      input.signingKid,
      input.expiresAt,
    ],
  );
  return res.rows[0]!;
}

export async function getWidgetSession(
  client: DbClient,
  input: Readonly<{ sessionId: string }>,
): Promise<WidgetSessionRow | null> {
  const res = await client.query<WidgetSessionRow>(
    `SELECT * FROM widget_sessions WHERE id = $1`,
    [input.sessionId],
  );
  return res.rows[0] ?? null;
}

export async function getWidgetSessionForUpdate(
  client: DbClient,
  input: Readonly<{ sessionId: string }>,
): Promise<WidgetSessionRow | null> {
  const res = await client.query<WidgetSessionRow>(
    `SELECT * FROM widget_sessions WHERE id = $1 FOR UPDATE`,
    [input.sessionId],
  );
  return res.rows[0] ?? null;
}

export async function updateWidgetSessionState(
  client: DbClient,
  input: Readonly<{
    sessionId: string;
    state: WidgetSessionState;
    failureReason?: string | null;
  }>,
): Promise<void> {
  const startedAtExpr = input.state === "STARTED" ? "now()" : "started_at";
  const consumedAtExpr = input.state === "CONSUMED" ? "now()" : "consumed_at";
  const cancelledAtExpr = input.state === "CANCELLED" ? "now()" : "cancelled_at";
  await client.query(
    `
    UPDATE widget_sessions
    SET status = $2,
        started_at = ${startedAtExpr},
        consumed_at = ${consumedAtExpr},
        cancelled_at = ${cancelledAtExpr},
        failure_reason = $3,
        updated_at = now()
    WHERE id = $1
    `,
    [input.sessionId, input.state, input.failureReason ?? null],
  );
}

export async function markWidgetSessionConsumed(
  client: DbClient,
  input: Readonly<{
    sessionId: string;
    idempotencyKey: string;
    consentId: string;
    consentEventId: string;
    consentVersionNo: number;
    currentStatus: string;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE widget_sessions
    SET status = 'CONSUMED',
        consumed_at = now(),
        idempotency_key = $2,
        consent_id = $3,
        consent_event_id = $4,
        consent_version_no = $5,
        current_status = $6,
        updated_at = now()
    WHERE id = $1
    `,
    [
      input.sessionId,
      input.idempotencyKey,
      input.consentId,
      input.consentEventId,
      input.consentVersionNo,
      input.currentStatus,
    ],
  );
}


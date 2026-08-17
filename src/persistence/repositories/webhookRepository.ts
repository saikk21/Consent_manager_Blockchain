import { randomUUID } from "node:crypto";
import type { DbClient } from "../db/pool.js";

export type WebhookEndpointStatus = "ACTIVE" | "PAUSED";
export type WebhookDeliveryStatus = "PENDING" | "CLAIMED" | "DELIVERED" | "DEAD_LETTER";

export type WebhookEndpointRow = Readonly<{
  id: string;
  company_id: string;
  environment: string;
  url: string;
  subscribed_events: string[];
  status: WebhookEndpointStatus;
  signing_secret: string;
  previous_signing_secret: string | null;
  secret_rotated_at: string | null;
  signature_algorithm: string;
  created_at: string;
  updated_at: string;
}>;

export type WebhookDeliveryRow = Readonly<{
  id: string;
  company_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  last_http_status: number | null;
  signature_header: string | null;
  signature_timestamp: number | null;
  claimed_at: string | null;
  delivered_at: string | null;
  dead_lettered_at: string | null;
  created_at: string;
  updated_at: string;
}>;

export async function createWebhookEndpoint(
  client: DbClient,
  input: Readonly<{
    companyId: string;
    environment: string;
    url: string;
    subscribedEvents: string[];
    signingSecret: string;
  }>,
): Promise<WebhookEndpointRow> {
  const res = await client.query<WebhookEndpointRow>(
    `
    INSERT INTO webhook_endpoints (
      company_id, environment, url, subscribed_events, status, signing_secret, signature_algorithm
    )
    VALUES ($1,$2,$3,$4::jsonb,'ACTIVE',$5,'HMAC_SHA256_V1')
    RETURNING *
    `,
    [input.companyId, input.environment, input.url, JSON.stringify(input.subscribedEvents), input.signingSecret],
  );
  return res.rows[0]!;
}

export async function listWebhookEndpoints(
  client: DbClient,
  input: Readonly<{ companyId: string; cursorOffset: number; limit: number }>,
): Promise<WebhookEndpointRow[]> {
  const res = await client.query<WebhookEndpointRow>(
    `
    SELECT *
    FROM webhook_endpoints
    WHERE company_id = $1
    ORDER BY created_at DESC
    OFFSET $2
    LIMIT $3
    `,
    [input.companyId, input.cursorOffset, input.limit],
  );
  return res.rows;
}

export async function getWebhookEndpointById(
  client: DbClient,
  input: Readonly<{ endpointId: string; companyId: string }>,
): Promise<WebhookEndpointRow | null> {
  const res = await client.query<WebhookEndpointRow>(
    `
    SELECT *
    FROM webhook_endpoints
    WHERE id = $1 AND company_id = $2
    `,
    [input.endpointId, input.companyId],
  );
  return res.rows[0] ?? null;
}

export async function updateWebhookEndpoint(
  client: DbClient,
  input: Readonly<{
    endpointId: string;
    companyId: string;
    status?: WebhookEndpointStatus;
    subscribedEvents?: string[];
    url?: string;
  }>,
): Promise<WebhookEndpointRow | null> {
  const res = await client.query<WebhookEndpointRow>(
    `
    UPDATE webhook_endpoints
    SET status = COALESCE($3, status),
        subscribed_events = COALESCE($4::jsonb, subscribed_events),
        url = COALESCE($5, url),
        updated_at = now()
    WHERE id = $1 AND company_id = $2
    RETURNING *
    `,
    [
      input.endpointId,
      input.companyId,
      input.status ?? null,
      input.subscribedEvents ? JSON.stringify(input.subscribedEvents) : null,
      input.url ?? null,
    ],
  );
  return res.rows[0] ?? null;
}

export async function rotateWebhookEndpointSecret(
  client: DbClient,
  input: Readonly<{ endpointId: string; companyId: string; newSecret: string }>,
): Promise<WebhookEndpointRow | null> {
  const res = await client.query<WebhookEndpointRow>(
    `
    UPDATE webhook_endpoints
    SET previous_signing_secret = signing_secret,
        signing_secret = $3,
        secret_rotated_at = now(),
        updated_at = now()
    WHERE id = $1 AND company_id = $2
    RETURNING *
    `,
    [input.endpointId, input.companyId, input.newSecret],
  );
  return res.rows[0] ?? null;
}

export async function selectActiveEndpointsByEventType(
  client: DbClient,
  input: Readonly<{ companyId: string; eventType: string }>,
): Promise<WebhookEndpointRow[]> {
  const res = await client.query<WebhookEndpointRow>(
    `
    SELECT *
    FROM webhook_endpoints
    WHERE company_id = $1
      AND status = 'ACTIVE'
      AND subscribed_events @> to_jsonb(ARRAY[$2]::text[])
    `,
    [input.companyId, input.eventType],
  );
  return res.rows;
}

export async function createWebhookDeliveryRows(
  client: DbClient,
  input: Readonly<{
    companyId: string;
    eventId?: string;
    eventType: string;
    payload: unknown;
    endpointIds: string[];
  }>,
): Promise<number> {
  let count = 0;
  for (const endpointId of input.endpointIds) {
    await client.query(
      `
      INSERT INTO webhook_deliveries (
        company_id, endpoint_id, event_id, event_type, payload, status, next_attempt_at
      )
      VALUES ($1,$2,$3,$4,$5::jsonb,'PENDING',now())
      ON CONFLICT (endpoint_id, event_id) DO NOTHING
      `,
      [
        input.companyId,
        endpointId,
        input.eventId ?? randomUUID(),
        input.eventType,
        JSON.stringify(input.payload),
      ],
    );
    count += 1;
  }
  return count;
}

export async function claimWebhookDeliveries(
  client: DbClient,
  input: Readonly<{ limit: number }>,
): Promise<WebhookDeliveryRow[]> {
  const res = await client.query<WebhookDeliveryRow>(
    `
    WITH cte AS (
      SELECT id
      FROM webhook_deliveries
      WHERE status = 'PENDING'
        AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE webhook_deliveries d
    SET status = 'CLAIMED',
        attempt_count = d.attempt_count + 1,
        claimed_at = now(),
        updated_at = now()
    FROM cte
    WHERE d.id = cte.id
    RETURNING *
    `,
    [input.limit],
  );
  return res.rows;
}

export async function getEndpointById(
  client: DbClient,
  input: Readonly<{ endpointId: string }>,
): Promise<WebhookEndpointRow | null> {
  const res = await client.query<WebhookEndpointRow>(
    `SELECT * FROM webhook_endpoints WHERE id = $1`,
    [input.endpointId],
  );
  return res.rows[0] ?? null;
}

export async function markDeliveryDelivered(
  client: DbClient,
  input: Readonly<{
    deliveryId: string;
    signatureHeader: string;
    signatureTimestamp: number;
    httpStatus: number;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE webhook_deliveries
    SET status = 'DELIVERED',
        delivered_at = now(),
        signature_header = $2,
        signature_timestamp = $3,
        last_http_status = $4,
        last_error = NULL,
        updated_at = now()
    WHERE id = $1
    `,
    [input.deliveryId, input.signatureHeader, input.signatureTimestamp, input.httpStatus],
  );
}

export async function requeueDelivery(
  client: DbClient,
  input: Readonly<{
    deliveryId: string;
    nextAttemptAt: Date;
    errorMessage: string;
    httpStatus?: number | null;
    signatureHeader: string;
    signatureTimestamp: number;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE webhook_deliveries
    SET status = 'PENDING',
        next_attempt_at = $2,
        last_error = $3,
        last_http_status = $4,
        signature_header = $5,
        signature_timestamp = $6,
        updated_at = now()
    WHERE id = $1
    `,
    [
      input.deliveryId,
      input.nextAttemptAt.toISOString(),
      input.errorMessage.slice(0, 2000),
      input.httpStatus ?? null,
      input.signatureHeader,
      input.signatureTimestamp,
    ],
  );
}

export async function markDeliveryDeadLetter(
  client: DbClient,
  input: Readonly<{
    deliveryId: string;
    errorMessage: string;
    httpStatus?: number | null;
    signatureHeader: string;
    signatureTimestamp: number;
  }>,
): Promise<void> {
  await client.query(
    `
    UPDATE webhook_deliveries
    SET status = 'DEAD_LETTER',
        dead_lettered_at = now(),
        last_error = $2,
        last_http_status = $3,
        signature_header = $4,
        signature_timestamp = $5,
        updated_at = now()
    WHERE id = $1
    `,
    [
      input.deliveryId,
      input.errorMessage.slice(0, 2000),
      input.httpStatus ?? null,
      input.signatureHeader,
      input.signatureTimestamp,
    ],
  );
}


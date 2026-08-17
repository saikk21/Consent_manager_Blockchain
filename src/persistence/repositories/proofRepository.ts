import type { DbClient } from "../db/pool.js";

export type ClaimedOutboxRow = Readonly<{
  id: string;
  aggregate_id: string;
  payload: unknown;
  attempt_count: number;
}>;

export type ProofEventRow = Readonly<{
  event_id: string;
  company_id: string;
  consent_id: string;
  external_user_id: string;
  purpose_code: string;
  event_type: string;
  version_no: number;
  event_hash: string;
  occurred_at: string;
  recorded_at: string;
  policy_ref: string;
}>;

export type ProofBatchRow = Readonly<{
  id: string;
  batch_no: string;
  state: "OPEN" | "SEALED" | "ANCHORED" | "FAILED";
  anchor_status: "NOT_SENT" | "SENT" | "CONFIRMED" | "FAILED";
  anchor_mode: string;
  anchor_ref: string | null;
  root_hash: string | null;
  event_count: number;
  tree_algo: string;
  created_at: string;
  sealed_at: string | null;
  anchor_sent_at: string | null;
  anchor_confirmed_at: string | null;
}>;

export type EventProofDetailsRow = Readonly<{
  event_id: string;
  proof_status: "PENDING" | "READY" | "FAILED";
  proof_batch_id: string | null;
  root_hash: string | null;
  path_hashes: unknown | null;
  path_positions: unknown | null;
  leaf_index: number | null;
  leaf_hash: string | null;
  anchor_status: "NOT_SENT" | "SENT" | "CONFIRMED" | "FAILED" | null;
  anchor_ref: string | null;
  anchor_mode: string | null;
  anchor_confirmed_at: string | null;
  batch_no: string | null;
  batch_state: "OPEN" | "SEALED" | "ANCHORED" | "FAILED" | null;
}>;

export type ConsentProofTimelineRow = Readonly<{
  version_no: number;
  event_id: string;
  event_type: string;
  proof_status: string;
  proof_batch_id: string | null;
  root_hash: string | null;
}>;

export async function claimProofOutboxRows(
  client: DbClient,
  input: Readonly<{ limit: number }>,
): Promise<ClaimedOutboxRow[]> {
  const res = await client.query<ClaimedOutboxRow>(
    `
    WITH cte AS (
      SELECT id
      FROM outbox
      WHERE topic = 'proof.pending'
        AND status = 'NEW'
        AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox o
    SET status = 'CLAIMED',
        claimed_at = now(),
        attempt_count = o.attempt_count + 1
    FROM cte
    WHERE o.id = cte.id
    RETURNING o.id, o.aggregate_id, o.payload, o.attempt_count
    `,
    [input.limit],
  );
  return res.rows;
}

export async function fetchProofEventsByIds(
  client: DbClient,
  input: Readonly<{ eventIds: string[] }>,
): Promise<ProofEventRow[]> {
  if (input.eventIds.length === 0) return [];
  const res = await client.query<ProofEventRow>(
    `
    SELECT
      e.id AS event_id,
      e.company_id,
      e.consent_id,
      c.external_user_id,
      c.purpose_code,
      e.event_type,
      e.version_no,
      e.event_hash,
      cv.occurred_at,
      e.recorded_at,
      cv.policy_ref
    FROM events e
    INNER JOIN consents c ON c.id = e.consent_id
    INNER JOIN consent_versions cv ON cv.event_id = e.id
    WHERE e.id = ANY($1::uuid[])
    ORDER BY e.recorded_at, e.id
    `,
    [input.eventIds],
  );
  return res.rows;
}

export async function createProofBatch(
  client: DbClient,
  input: Readonly<{ eventCount: number; rootHash: string }>,
): Promise<ProofBatchRow> {
  const res = await client.query<ProofBatchRow>(
    `
    INSERT INTO proof_batches (
      state,
      event_count,
      tree_algo,
      root_hash,
      sealed_at
    )
    VALUES ('SEALED', $1, 'MERKLE_SHA256_V1', $2, now())
    RETURNING
      id,
      batch_no,
      state,
      anchor_status,
      anchor_mode,
      anchor_ref,
      root_hash,
      event_count,
      tree_algo,
      created_at,
      sealed_at,
      anchor_sent_at,
      anchor_confirmed_at
    `,
    [input.eventCount, input.rootHash],
  );
  return res.rows[0]!;
}

export async function insertProofBatchEvent(
  client: DbClient,
  input: Readonly<{
    proofBatchId: string;
    eventId: string;
    leafIndex: number;
    leafHash: string;
  }>,
): Promise<void> {
  await client.query(
    `
    INSERT INTO proof_batch_events (
      proof_batch_id,
      event_id,
      leaf_index,
      leaf_hash
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (event_id) DO NOTHING
    `,
    [input.proofBatchId, input.eventId, input.leafIndex, input.leafHash],
  );
}

export async function insertProofPath(
  client: DbClient,
  input: Readonly<{
    proofBatchId: string;
    eventId: string;
    rootHash: string;
    pathHashes: string[];
    pathPositions: Array<"L" | "R">;
  }>,
): Promise<void> {
  await client.query(
    `
    INSERT INTO proof_paths (
      event_id,
      proof_batch_id,
      root_hash,
      path_hashes,
      path_positions,
      algo_version
    )
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'MERKLE_SHA256_V1')
    ON CONFLICT (event_id) DO NOTHING
    `,
    [
      input.eventId,
      input.proofBatchId,
      input.rootHash,
      JSON.stringify(input.pathHashes),
      JSON.stringify(input.pathPositions),
    ],
  );
}

export async function markEventProofReady(
  client: DbClient,
  input: Readonly<{ eventId: string; proofBatchId: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE events
    SET proof_status = 'READY',
        proof_batch_id = $2
    WHERE id = $1
      AND proof_status <> 'READY'
    `,
    [input.eventId, input.proofBatchId],
  );
}

export async function markOutboxDone(
  client: DbClient,
  input: Readonly<{ outboxId: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE outbox
    SET status = 'DONE',
        processed_at = now(),
        last_error = NULL
    WHERE id = $1
    `,
    [input.outboxId],
  );
}

export async function requeueOutbox(
  client: DbClient,
  input: Readonly<{ outboxId: string; nextAttemptAt: Date; errorMessage: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE outbox
    SET status = 'NEW',
        next_attempt_at = $2,
        last_error = $3
    WHERE id = $1
    `,
    [input.outboxId, input.nextAttemptAt.toISOString(), input.errorMessage.slice(0, 1000)],
  );
}

export async function failOutbox(
  client: DbClient,
  input: Readonly<{ outboxId: string; errorMessage: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE outbox
    SET status = 'FAILED',
        last_error = $2
    WHERE id = $1
    `,
    [input.outboxId, input.errorMessage.slice(0, 1000)],
  );
}

export async function claimSealedBatchForAnchor(client: DbClient): Promise<ProofBatchRow | null> {
  const res = await client.query<ProofBatchRow>(
    `
    WITH cte AS (
      SELECT id
      FROM proof_batches
      WHERE state = 'SEALED'
        AND anchor_status = 'NOT_SENT'
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE proof_batches pb
    SET anchor_status = 'SENT',
        anchor_sent_at = now(),
        updated_at = now()
    FROM cte
    WHERE pb.id = cte.id
    RETURNING
      pb.id,
      pb.batch_no,
      pb.state,
      pb.anchor_status,
      pb.anchor_mode,
      pb.anchor_ref,
      pb.root_hash,
      pb.event_count,
      pb.tree_algo,
      pb.created_at,
      pb.sealed_at,
      pb.anchor_sent_at,
      pb.anchor_confirmed_at
    `,
  );
  return res.rows[0] ?? null;
}

export async function confirmMockAnchor(
  client: DbClient,
  input: Readonly<{ batchId: string; anchorRef: string }>,
): Promise<void> {
  await client.query(
    `
    UPDATE proof_batches
    SET state = 'ANCHORED',
        anchor_status = 'CONFIRMED',
        anchor_ref = $2,
        anchor_confirmed_at = now(),
        updated_at = now()
    WHERE id = $1
    `,
    [input.batchId, input.anchorRef],
  );
}

export async function getEventProofDetails(
  client: DbClient,
  input: Readonly<{ eventId: string }>,
): Promise<EventProofDetailsRow | null> {
  const res = await client.query<EventProofDetailsRow>(
    `
    SELECT
      e.id AS event_id,
      e.proof_status,
      e.proof_batch_id,
      pp.root_hash,
      pp.path_hashes,
      pp.path_positions,
      pbe.leaf_index,
      pbe.leaf_hash,
      pb.anchor_status,
      pb.anchor_ref,
      pb.anchor_mode,
      pb.anchor_confirmed_at,
      pb.batch_no,
      pb.state AS batch_state
    FROM events e
    LEFT JOIN proof_paths pp ON pp.event_id = e.id
    LEFT JOIN proof_batch_events pbe ON pbe.event_id = e.id
    LEFT JOIN proof_batches pb ON pb.id = e.proof_batch_id
    WHERE e.id = $1
    `,
    [input.eventId],
  );
  return res.rows[0] ?? null;
}

export async function getConsentProofTimeline(
  client: DbClient,
  input: Readonly<{ consentId: string; cursorVersionNo: number; limit: number }>,
): Promise<ConsentProofTimelineRow[]> {
  const res = await client.query<ConsentProofTimelineRow>(
    `
    SELECT
      e.version_no,
      e.id AS event_id,
      e.event_type,
      e.proof_status,
      e.proof_batch_id,
      pp.root_hash
    FROM events e
    LEFT JOIN proof_paths pp ON pp.event_id = e.id
    WHERE e.consent_id = $1
      AND e.version_no > $2
    ORDER BY e.version_no
    LIMIT $3
    `,
    [input.consentId, input.cursorVersionNo, input.limit],
  );
  return res.rows;
}

export async function getProofBatchById(
  client: DbClient,
  input: Readonly<{ batchId: string }>,
): Promise<ProofBatchRow | null> {
  const res = await client.query<ProofBatchRow>(
    `
    SELECT
      id,
      batch_no,
      state,
      anchor_status,
      anchor_mode,
      anchor_ref,
      root_hash,
      event_count,
      tree_algo,
      created_at,
      sealed_at,
      anchor_sent_at,
      anchor_confirmed_at
    FROM proof_batches
    WHERE id = $1
    `,
    [input.batchId],
  );
  return res.rows[0] ?? null;
}

export async function getProofBatchCompanyId(
  client: DbClient,
  input: Readonly<{ batchId: string }>,
): Promise<string | null> {
  const res = await client.query<{ company_id: string }>(
    `
    SELECT e.company_id
    FROM proof_batch_events pbe
    INNER JOIN events e ON e.id = pbe.event_id
    WHERE pbe.proof_batch_id = $1
    LIMIT 1
    `,
    [input.batchId],
  );
  return res.rows[0]?.company_id ?? null;
}


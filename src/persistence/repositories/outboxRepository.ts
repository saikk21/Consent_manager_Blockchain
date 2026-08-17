import type { DbClient } from "../db/pool.js";

export type OutboxStatus = "NEW" | "CLAIMED" | "DONE" | "FAILED";

export async function enqueueOutboxMessage(
  client: DbClient,
  input: Readonly<{
    topic: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
  }>,
): Promise<void> {
  await client.query(
    `
    INSERT INTO outbox (
      topic,
      aggregate_type,
      aggregate_id,
      payload,
      status
    )
    VALUES ($1, $2, $3, $4::jsonb, 'NEW')
    `,
    [input.topic, input.aggregateType, input.aggregateId, JSON.stringify(input.payload)],
  );
}


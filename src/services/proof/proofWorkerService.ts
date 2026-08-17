import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  claimProofOutboxRows,
  createProofBatch,
  failOutbox,
  fetchProofEventsByIds,
  insertProofBatchEvent,
  insertProofPath,
  markEventProofReady,
  markOutboxDone,
  requeueOutbox,
  type ClaimedOutboxRow,
} from "../../persistence/repositories/proofRepository.js";
import { buildMerkleTree } from "./merkleTree.js";
import { computeLeafHash } from "./canonicalHashing.js";
import type { WebhookEventService } from "../webhooks/webhookEventService.js";

function computeBackoff(attemptCount: number): number {
  const baseMs = 2_000;
  const capMs = 300_000;
  const expMs = Math.min(capMs, baseMs * 2 ** Math.max(0, attemptCount - 1));
  const jitter = Math.floor(Math.random() * Math.max(1, expMs * 0.2));
  return expMs + jitter;
}

export class ProofWorkerService {
  constructor(
    private readonly pool: DbPool,
    private readonly webhookEvent?: WebhookEventService,
  ) {}

  async processNextBatch(limit = 200): Promise<number> {
    const claimedRows = await withTx(this.pool, (client) => claimProofOutboxRows(client, { limit }));
    if (claimedRows.length === 0) return 0;

    const claimedByEventId = new Map<string, ClaimedOutboxRow>();
    for (const row of claimedRows) claimedByEventId.set(row.aggregate_id, row);

    try {
      const proofEvents = await withTx(this.pool, (client) =>
        fetchProofEventsByIds(client, { eventIds: [...claimedByEventId.keys()] }),
      );
      if (proofEvents.length === 0) {
        // Poison/out-of-contract outbox rows: referenced events do not exist.
        for (const row of claimedRows) {
          await withTx(this.pool, (client) =>
            failOutbox(client, {
              outboxId: row.id,
              errorMessage: "Referenced event not found for proof.pending outbox row.",
            }),
          );
        }
        return 0;
      }

      const leaves = proofEvents.map((ev) =>
        computeLeafHash({
          eventId: ev.event_id,
          companyId: ev.company_id,
          consentId: ev.consent_id,
          externalUserId: ev.external_user_id,
          purposeCode: ev.purpose_code,
          eventType: ev.event_type,
          versionNo: ev.version_no,
          policyRef: ev.policy_ref,
          occurredAt: ev.occurred_at,
          recordedAt: ev.recorded_at,
          eventHash: ev.event_hash,
        }),
      );

      const merkle = buildMerkleTree(leaves);

      await withTx(this.pool, async (client) => {
        const batch = await createProofBatch(client, {
          eventCount: proofEvents.length,
          rootHash: merkle.rootHash,
        });

        for (let i = 0; i < proofEvents.length; i += 1) {
          const ev = proofEvents[i]!;
          const proof = merkle.proofs[i]!;
          const leafHash = leaves[i]!;
          const claimed = claimedByEventId.get(ev.event_id);
          if (!claimed) continue;

          await insertProofBatchEvent(client, {
            proofBatchId: batch.id,
            eventId: ev.event_id,
            leafIndex: proof.leafIndex,
            leafHash,
          });
          await insertProofPath(client, {
            proofBatchId: batch.id,
            eventId: ev.event_id,
            rootHash: merkle.rootHash,
            pathHashes: proof.pathHashes,
            pathPositions: proof.pathPositions,
          });
          await markEventProofReady(client, { eventId: ev.event_id, proofBatchId: batch.id });
          await markOutboxDone(client, { outboxId: claimed.id });
        }
      });

      for (const ev of proofEvents) {
        await this.webhookEvent?.enqueueEvent(ev.company_id, "proof.ready", {
          event_id: ev.event_id,
          consent_id: ev.consent_id,
          batch_root_hash: merkle.rootHash,
        });
      }

      return proofEvents.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown proof worker error";
      for (const row of claimedRows) {
        await withTx(this.pool, async (client) => {
          if (row.attempt_count >= 10) {
            await failOutbox(client, { outboxId: row.id, errorMessage: message });
            return;
          }
          const nextAttemptAt = new Date(Date.now() + computeBackoff(row.attempt_count));
          await requeueOutbox(client, {
            outboxId: row.id,
            nextAttemptAt,
            errorMessage: message,
          });
        });
      }
      return 0;
    }
  }
}


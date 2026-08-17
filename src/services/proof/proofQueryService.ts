import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import { getConsentById } from "../../persistence/repositories/consentRepository.js";
import {
  getConsentProofTimeline,
  getEventProofDetails,
  getProofBatchById,
} from "../../persistence/repositories/proofRepository.js";
import { verifyMerkleProof } from "./merkleTree.js";

export class ProofQueryService {
  constructor(private readonly pool: DbPool) {}

  async getEventProof(eventId: string) {
    return withTx(this.pool, async (client) => {
      const row = await getEventProofDetails(client, { eventId });
      if (!row) return null;
      if (row.proof_status !== "READY") {
        return { eventId: row.event_id, proofStatus: row.proof_status };
      }
      return {
        eventId: row.event_id,
        proofStatus: row.proof_status,
        proofBatch: {
          batchId: row.proof_batch_id,
          batchNo: row.batch_no,
          state: row.batch_state,
          rootHash: row.root_hash,
        },
        leaf: {
          index: row.leaf_index,
          hash: row.leaf_hash,
        },
        path: {
          hashes: Array.isArray(row.path_hashes) ? row.path_hashes : [],
          positions: Array.isArray(row.path_positions) ? row.path_positions : [],
        },
        anchor: {
          mode: row.anchor_mode,
          status: row.anchor_status,
          ref: row.anchor_ref,
          confirmedAt: row.anchor_confirmed_at,
        },
      };
    });
  }

  async getConsentProofs(input: Readonly<{
    companyId: string;
    consentId: string;
    cursorVersionNo: number;
    limit: number;
  }>) {
    return withTx(this.pool, async (client) => {
      const consent = await getConsentById(client, {
        consentId: input.consentId,
        companyId: input.companyId,
      });
      if (!consent) return null;

      const rows = await getConsentProofTimeline(client, {
        consentId: input.consentId,
        cursorVersionNo: input.cursorVersionNo,
        limit: input.limit + 1,
      });
      const hasMore = rows.length > input.limit;
      const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.version_no ?? null : null;

      return {
        consentId: consent.id,
        items: pageRows.map((r) => ({
          versionNo: r.version_no,
          eventId: r.event_id,
          eventType: r.event_type,
          proofStatus: r.proof_status,
          proofBatchId: r.proof_batch_id,
          rootHash: r.root_hash,
        })),
        page: {
          limit: input.limit,
          nextCursor,
          hasMore,
        },
      };
    });
  }

  async getBatch(batchId: string) {
    return withTx(this.pool, async (client) => getProofBatchById(client, { batchId }));
  }

  verifyProof(input: Readonly<{
    leafHash: string;
    pathHashes: string[];
    pathPositions: Array<"L" | "R">;
    rootHash: string;
  }>) {
    return {
      valid: verifyMerkleProof(
        input.leafHash,
        input.pathHashes,
        input.pathPositions,
        input.rootHash,
      ),
    };
  }
}


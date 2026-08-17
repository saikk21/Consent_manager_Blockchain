import { createHash } from "node:crypto";
import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  claimSealedBatchForAnchor,
  confirmMockAnchor,
  getProofBatchCompanyId,
} from "../../persistence/repositories/proofRepository.js";
import type { WebhookEventService } from "../webhooks/webhookEventService.js";

export class MockAnchorWorkerService {
  constructor(
    private readonly pool: DbPool,
    private readonly webhookEvent?: WebhookEventService,
  ) {}

  async processNextBatch(): Promise<boolean> {
    const claimed = await withTx(this.pool, (client) => claimSealedBatchForAnchor(client));
    if (!claimed) return false;

    const root = claimed.root_hash ?? "missing_root";
    const hashPrefix = createHash("sha256").update(root).digest("hex").slice(0, 12);
    const anchorRef = `mock_tx_${claimed.batch_no}_${hashPrefix}`;

    await withTx(this.pool, (client) =>
      confirmMockAnchor(client, {
        batchId: claimed.id,
        anchorRef,
      }),
    );
    const companyId = await withTx(this.pool, (client) =>
      getProofBatchCompanyId(client, { batchId: claimed.id }),
    );
    if (companyId) {
      await this.webhookEvent?.enqueueEvent(companyId, "proof.anchor_confirmed", {
        batch_id: claimed.id,
        anchor_ref: anchorRef,
        root_hash: claimed.root_hash,
      });
    }

    return true;
  }
}


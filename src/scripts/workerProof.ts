import { createPool } from "../persistence/db/pool.js";
import { ProofWorkerService } from "../services/proof/proofWorkerService.js";
import { WebhookEventService } from "../services/webhooks/webhookEventService.js";

const POLL_MS = Number(process.env.PROOF_WORKER_POLL_MS ?? 2000);
const CLAIM_LIMIT = Number(process.env.PROOF_WORKER_CLAIM_LIMIT ?? 200);

async function main() {
  const pool = createPool();
  const webhookEvent = new WebhookEventService(pool);
  const worker = new ProofWorkerService(pool, webhookEvent);

  // eslint-disable-next-line no-console
  console.log(`proof worker started pollMs=${POLL_MS} claimLimit=${CLAIM_LIMIT}`);

  const timer = setInterval(async () => {
    try {
      const processed = await worker.processNextBatch(CLAIM_LIMIT);
      if (processed > 0) {
        // eslint-disable-next-line no-console
        console.log(`proof worker processed events=${processed}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("proof worker loop error", err);
    }
  }, POLL_MS);

  const shutdown = async () => {
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main();


import { createPool } from "../persistence/db/pool.js";
import { MockAnchorWorkerService } from "../services/proof/mockAnchorWorkerService.js";
import { WebhookEventService } from "../services/webhooks/webhookEventService.js";

const POLL_MS = Number(process.env.ANCHOR_WORKER_POLL_MS ?? 3000);

async function main() {
  const pool = createPool();
  const webhookEvent = new WebhookEventService(pool);
  const worker = new MockAnchorWorkerService(pool, webhookEvent);

  // eslint-disable-next-line no-console
  console.log(`mock anchor worker started pollMs=${POLL_MS}`);

  const timer = setInterval(async () => {
    try {
      const processed = await worker.processNextBatch();
      if (processed) {
        // eslint-disable-next-line no-console
        console.log("mock anchor worker confirmed one batch");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("mock anchor worker loop error", err);
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


import { createPool } from "../persistence/db/pool.js";
import { WebhookDeliveryWorkerService } from "../services/webhooks/webhookDeliveryWorkerService.js";

const POLL_MS = Number(process.env.WEBHOOK_WORKER_POLL_MS ?? 2000);
const CLAIM_LIMIT = Number(process.env.WEBHOOK_WORKER_CLAIM_LIMIT ?? 100);

async function main() {
  const pool = createPool();
  const worker = new WebhookDeliveryWorkerService(pool);

  // eslint-disable-next-line no-console
  console.log(`webhook worker started pollMs=${POLL_MS} claimLimit=${CLAIM_LIMIT}`);

  const timer = setInterval(async () => {
    try {
      const processed = await worker.processNext(CLAIM_LIMIT);
      if (processed > 0) {
        // eslint-disable-next-line no-console
        console.log(`webhook worker delivered count=${processed}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("webhook worker loop error", err);
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


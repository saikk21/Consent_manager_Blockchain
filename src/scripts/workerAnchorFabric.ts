import { createPool } from '../persistence/db/pool.js';
import { FabricAnchorWorkerService } from '../services/proof/fabricAnchorWorkerService.js';
import { WebhookEventService } from '../services/webhooks/webhookEventService.js';

const POLL_MS = Number(process.env.ANCHOR_WORKER_POLL_MS ?? 5000);

async function main() {
  const pool = createPool();
  const webhookEvent = new WebhookEventService(pool);
  const worker = new FabricAnchorWorkerService(pool, webhookEvent);

  console.log('[fabric-anchor] Worker started pollMs=' + POLL_MS);

  const timer = setInterval(async () => {
    try {
      const processed = await worker.processNextBatch();
      if (processed) {
        console.log('[fabric-anchor] Successfully anchored one batch on Fabric');
      }
    } catch (err) {
      console.error('[fabric-anchor] Worker loop error:', err);
    }
  }, POLL_MS);

  const shutdown = async () => {
    console.log('[fabric-anchor] Shutting down...');
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

await main();

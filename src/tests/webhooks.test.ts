import { strict as assert } from "node:assert";
import http from "node:http";
import pg from "pg";
import { createPool } from "../persistence/db/pool.js";
import { withTx } from "../persistence/db/tx.js";
import {
  canonicalWebhookPayload,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../security/webhookSigning.js";
import { WebhookDeliveryWorkerService } from "../services/webhooks/webhookDeliveryWorkerService.js";
import { WebhookEventService } from "../services/webhooks/webhookEventService.js";
import {
  createWebhookDeliveryRows,
  createWebhookEndpoint,
} from "../persistence/repositories/webhookRepository.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSignatureTests() {
  const payload = { b: 2, a: 1 };
  const body = canonicalWebhookPayload(payload);
  assert.equal(body, '{"a":1,"b":2}');
  const ts = Math.floor(Date.now() / 1000);
  const signed = signWebhookPayload(payload, "whsec_test", ts);
  assert.equal(
    verifyWebhookSignature({
      payload,
      header: signed.header,
      secret: "whsec_test",
      maxAgeSeconds: 60,
      nowEpochSeconds: ts + 10,
    }),
    true,
  );
  assert.equal(
    verifyWebhookSignature({
      payload,
      header: signed.header,
      secret: "wrong_secret",
      maxAgeSeconds: 60,
      nowEpochSeconds: ts + 10,
    }),
    false,
  );
  assert.equal(
    verifyWebhookSignature({
      payload,
      header: signed.header,
      secret: "whsec_test",
      maxAgeSeconds: 5,
      nowEpochSeconds: ts + 100,
    }),
    false,
  );
}

async function runDbTests() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("SKIP webhooks.test.ts (DATABASE_URL not set)");
    return;
  }

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  const pool = createPool();
  const worker = new WebhookDeliveryWorkerService(pool);
  const emitter = new WebhookEventService(pool);

  const attempts = new Map<string, number>();
  const server = http.createServer((req, res) => {
    const route = req.url ?? "/";
    const current = attempts.get(route) ?? 0;
    attempts.set(route, current + 1);
    if (route === "/retry" && current < 2) {
      res.statusCode = 500;
      res.end("retry");
      return;
    }
    if (route === "/dead") {
      res.statusCode = 400;
      res.end("dead");
      return;
    }
    res.statusCode = 200;
    res.end("ok");
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const companyRes = await admin.query<{ id: string }>(
      "insert into companies (name) values ('WebhookTestCo') returning id",
    );
    const companyId = companyRes.rows[0]!.id;

    const retryEndpoint = await withTx(pool, (client) =>
      createWebhookEndpoint(client, {
        companyId,
        environment: "dev",
        url: `${baseUrl}/retry`,
        subscribedEvents: ["consent.recorded"],
        signingSecret: "whsec_retry",
      }),
    );
    const deadEndpoint = await withTx(pool, (client) =>
      createWebhookEndpoint(client, {
        companyId,
        environment: "dev",
        url: `${baseUrl}/dead`,
        subscribedEvents: ["consent.recorded"],
        signingSecret: "whsec_dead",
      }),
    );

    // duplicate protection on (endpoint_id,event_id)
    await withTx(pool, (client) =>
      createWebhookDeliveryRows(client, {
        companyId,
        eventId: "00000000-0000-0000-0000-000000000111",
        eventType: "consent.recorded",
        payload: { type: "consent.recorded", company_id: companyId, data: {} },
        endpointIds: [retryEndpoint.id],
      }),
    );
    await withTx(pool, (client) =>
      createWebhookDeliveryRows(client, {
        companyId,
        eventId: "00000000-0000-0000-0000-000000000111",
        eventType: "consent.recorded",
        payload: { type: "consent.recorded", company_id: companyId, data: {} },
        endpointIds: [retryEndpoint.id],
      }),
    );
    const dupCount = await admin.query<{ count: string }>(
      "select count(*) from webhook_deliveries where endpoint_id = $1 and event_id = $2",
      [retryEndpoint.id, "00000000-0000-0000-0000-000000000111"],
    );
    assert.equal(Number(dupCount.rows[0]!.count), 1);

    await emitter.enqueueEvent(companyId, "consent.recorded", { source: "retry-check" });
    await emitter.enqueueEvent(companyId, "consent.recorded", { source: "dead-letter-check" });

    await admin.query(
      "update webhook_deliveries set max_attempts = 1 where endpoint_id = $1",
      [deadEndpoint.id],
    );

    // concurrency safety (no duplicate claims)
    await Promise.all([worker.processNext(10), worker.processNext(10)]);
    await sleep(2500);
    await worker.processNext(10);
    await sleep(4500);
    await worker.processNext(10);

    const retryStatus = await admin.query<{ status: string }>(
      "select status from webhook_deliveries where endpoint_id = $1 order by created_at desc limit 1",
      [retryEndpoint.id],
    );
    assert.equal(retryStatus.rows[0]!.status, "DELIVERED");

    const deadStatus = await admin.query<{ status: string }>(
      "select status from webhook_deliveries where endpoint_id = $1 order by created_at desc limit 1",
      [deadEndpoint.id],
    );
    assert.equal(deadStatus.rows[0]!.status, "DEAD_LETTER");
  } finally {
    server.close();
    await pool.end();
    await admin.end();
  }
}

await runSignatureTests();
await runDbTests();
// eslint-disable-next-line no-console
console.log("webhooks tests passed");


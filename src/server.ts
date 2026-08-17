import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { loadEnv } from "./config/env.js";
import { createPool } from "./persistence/db/pool.js";

import { ConsentLifecycleService } from "./services/consentLifecycle/consentLifecycleService.js";
import { ConsentQueryService } from "./services/consentQuery/consentQueryService.js";
import { ProofQueryService } from "./services/proof/proofQueryService.js";
import { PolicyService } from "./services/policy/policyService.js";
import { WidgetSessionService } from "./services/widget/widgetSessionService.js";
import { WidgetRuntimeService } from "./services/widget/widgetRuntimeService.js";
import { WebhookManagementService } from "./services/webhooks/webhookManagementService.js";
import { WebhookEventService } from "./services/webhooks/webhookEventService.js";

import { registerConsentRoutes } from "./api/http/routes/consents.js";
import { registerProofRoutes } from "./api/http/routes/proofs.js";
import { registerPolicyRoutes } from "./api/http/routes/policies.js";
import { registerWidgetSessionRoutes } from "./api/http/routes/widgetSessions.js";
import { registerWidgetRuntimeRoutes } from "./api/http/routes/widgetRuntime.js";
import { registerWebhookRoutes } from "./api/http/routes/webhooks.js";

export async function buildServer() {
  const env = loadEnv();

  const pool = createPool();

  const webhookEvent = new WebhookEventService(pool);

  const consentLifecycle = new ConsentLifecycleService(
    pool,
    webhookEvent,
  );

  const consentQuery = new ConsentQueryService(pool);

  const proofQuery = new ProofQueryService(pool);

  const policy = new PolicyService(pool);

  const webhookManagement = new WebhookManagementService(pool);

  const widgetSession = new WidgetSessionService(
    pool,
    consentLifecycle,
    webhookEvent,
  );

  const widgetRuntime = new WidgetRuntimeService(pool);

  const app = Fastify({
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.idempotency-key",
          "req.body.external_user_id",
        ],
        remove: true,
      },
    },

    requestIdHeader: "x-request-id",

    genReqId: () => randomUUID(),
  });

  // CORS
  await app.register(cors, {
    origin: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
    ],
  });

  // Security + helpers
  await app.register(helmet);

  await app.register(sensible);

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  // Decorators
  app.decorate("pool", pool);

  app.decorate("services", {
    consentLifecycle,
    consentQuery,
    proofQuery,
    policy,
    widgetSession,
    widgetRuntime,
    webhookManagement,
    webhookEvent,
  });

  // Cleanup
  app.addHook("onClose", async () => {
    await pool.end();
  });

  // Health
  app.get(
    "/healthz",
    {
      config: {
        skipApiKeyAuth: true,
      },
    },
    async () => ({
      ok: true,
    }),
  );

  // Meta
  app.get(
    "/v1/_meta",
    {
      config: {
        skipApiKeyAuth: true,
      },
    },
    async () => ({
      service: "sammati-ledger",
      phase: "A",
      now: new Date().toISOString(),
      auth: "Authorization: Bearer <API_KEY>",
    }),
  );

  // Routes
  await registerConsentRoutes(app);

  await registerProofRoutes(app);

  await registerPolicyRoutes(app);

  await registerWidgetSessionRoutes(app);

  await registerWidgetRuntimeRoutes(app);

  await registerWebhookRoutes(app);

  app.log.info(
    {
      phase: "A",

      features: [
        "consent-write",
        "consent-status-read",
        "consent-timeline-read",
        "proof-read",
        "policy-artifacts",
        "widget-sessions",
        "widget-runtime",
        "webhooks",
        "idempotency",
        "tx-outbox",
      ],
    },

    "Sammati Phase A server initialized",
  );

  return app;
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const env = loadEnv();

  const app = await buildServer();

  await app.listen({
    port: env.PORT,
    host: "0.0.0.0",
  });

  app.log.info(
    {
      port: env.PORT,
    },

    "HTTP server listening",
  );
}
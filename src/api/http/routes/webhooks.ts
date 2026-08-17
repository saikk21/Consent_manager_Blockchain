import type { FastifyInstance } from "fastify";
import { z } from "zod";
import "../types.js";
import { authApiKeyPlugin } from "../middleware/authApiKey.js";
import { WebhookEventTypes } from "../../../services/webhooks/webhookTypes.js";

export async function registerWebhookRoutes(app: FastifyInstance) {
  await authApiKeyPlugin(app, {});

  app.post("/v1/webhooks/endpoints", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 1) {
      throw app.httpErrors.badRequest("Missing Idempotency-Key header.");
    }
    try {
      const created = await app.services.webhookManagement.createEndpoint(companyId, req.body);
      return reply.code(201).send(created);
    } catch (err) {
      throw app.httpErrors.badRequest(err instanceof Error ? err.message : "Invalid request.");
    }
  });

  app.get("/v1/webhooks/endpoints", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const q = z
      .object({
        cursor: z.coerce.number().int().nonnegative().default(0),
        limit: z.coerce.number().int().positive().max(100).default(20),
      })
      .parse(req.query);
    return reply
      .code(200)
      .send(await app.services.webhookManagement.listEndpoints(companyId, q.cursor, q.limit));
  });

  app.patch("/v1/webhooks/endpoints/:endpointId", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const p = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    const updated = await app.services.webhookManagement.updateEndpoint(companyId, p.endpointId, req.body);
    if (!updated) throw app.httpErrors.notFound("Webhook endpoint not found.");
    return reply.code(200).send(updated);
  });

  app.post("/v1/webhooks/endpoints/:endpointId/rotate-secret", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 1) {
      throw app.httpErrors.badRequest("Missing Idempotency-Key header.");
    }
    const p = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    const rotated = await app.services.webhookManagement.rotateSecret(companyId, p.endpointId);
    if (!rotated) throw app.httpErrors.notFound("Webhook endpoint not found.");
    return reply.code(200).send(rotated);
  });

  app.post("/v1/webhooks/endpoints/:endpointId/test", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 1) {
      throw app.httpErrors.badRequest("Missing Idempotency-Key header.");
    }
    const p = z.object({ endpointId: z.string().uuid() }).parse(req.params);
    const endpoint = await app.services.webhookManagement.getEndpoint(companyId, p.endpointId);
    if (!endpoint) throw app.httpErrors.notFound("Webhook endpoint not found.");
    await app.services.webhookEvent.enqueueEvent(companyId, "consent.recorded", {
      type: "delivery.test",
      endpoint_id: p.endpointId,
      timestamp: new Date().toISOString(),
      available_events: WebhookEventTypes,
    });
    return reply.code(200).send({ endpointId: p.endpointId, result: "QUEUED" });
  });
}


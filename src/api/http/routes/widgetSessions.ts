import type { FastifyInstance } from "fastify";
import { z } from "zod";
import "../types.js";
import { authApiKeyPlugin } from "../middleware/authApiKey.js";
import {
  throwWidgetSessionCreateServiceError,
  throwWidgetSubmitServiceError,
} from "../widgetRouteErrors.js";

export async function registerWidgetSessionRoutes(app: FastifyInstance) {
  await app.register(async (secured) => {
    await authApiKeyPlugin(secured, {});

    secured.post("/v1/widget/sessions", async (req, reply) => {
      const companyId = req.companyId;
      if (!companyId) throw secured.httpErrors.unauthorized("Missing company context.");

      const idem = req.headers["idempotency-key"];
      if (typeof idem !== "string" || idem.length < 1) {
        throw secured.httpErrors.badRequest("Missing Idempotency-Key header.");
      }

      try {
        const created = await secured.services.widgetSession.createSession(companyId, req.body);
        return reply.code(201).send(created);
      } catch (err) {
        throwWidgetSessionCreateServiceError(secured.httpErrors, err, "Invalid session create request.");
      }
    });

    secured.get("/v1/widget/sessions/:sessionId", async (req, reply) => {
      const companyId = req.companyId;
      if (!companyId) throw secured.httpErrors.unauthorized("Missing company context.");
      const params = z.object({ sessionId: z.string().uuid() }).parse(req.params);
      const row = await secured.services.widgetSession.getSession(companyId, params.sessionId);
      if (!row) throw secured.httpErrors.notFound("Widget session not found.");
      return reply.code(200).send(row);
    });
  });

  app.post(
    "/v1/widget/sessions/:sessionId/submit",
    {
      config: { skipApiKeyAuth: true },
      helmet: false,
    },
    async (req, reply) => {
      const params = z.object({ sessionId: z.string().uuid() }).parse(req.params);
      const origin = req.headers.origin;
      const embedOrigin = req.headers["x-sammati-embed-origin"];
      try {
        const result = await app.services.widgetSession.submitSession(
          params.sessionId,
          req.body,
          typeof embedOrigin === "string"
            ? embedOrigin
            : typeof origin === "string"
              ? origin
              : undefined,
        );
        return reply.code(200).send(result);
      } catch (err) {
        throwWidgetSubmitServiceError(app.httpErrors, err, "Widget submit failed.");
      }
    },
  );
}


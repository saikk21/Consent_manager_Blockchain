import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ConsentAction } from "../../../domain/consent/types.js";
import { DomainError } from "../../../domain/consent/lifecycle.js";

const BodySchema = z.object({
  external_user_id: z.string().min(1).max(200),
  purpose_code: z.string().min(1).max(100),
  policy_ref: z.string().min(1).max(500),
  occurred_at: z.string().datetime(),
});

function mapDomainError(app: FastifyInstance, err: DomainError) {
  switch (err.code) {
    case "CONSENT_NOT_FOUND":
      return app.httpErrors.notFound(err.message);
    case "INVALID_TRANSITION":
      return app.httpErrors.badRequest(err.message);
    case "VALIDATION_ERROR":
      return app.httpErrors.conflict(err.message);
    default:
      return app.httpErrors.badRequest(err.message);
  }
}

export function makeConsentWriteHandler(action: ConsentAction) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const companyId = req.companyId;
    if (!companyId) throw req.server.httpErrors.unauthorized("Missing company context.");

    const idemKey = req.headers["idempotency-key"];
    if (typeof idemKey !== "string" || idemKey.length < 1) {
      throw req.server.httpErrors.badRequest("Missing Idempotency-Key header.");
    }

    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw req.server.httpErrors.badRequest("Invalid request body.");
    }

    try {
      const result = await req.server.services.consentLifecycle.recordConsent({
        companyId,
        idempotencyKey: idemKey,
        externalUserId: parsed.data.external_user_id,
        purposeCode: parsed.data.purpose_code,
        action,
        policyRef: parsed.data.policy_ref,
        occurredAt: parsed.data.occurred_at,
      });

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof DomainError) throw mapDomainError(req.server, err);
      throw err;
    }
  };
}


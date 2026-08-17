import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";

const StatusQuerySchema = z.object({
  external_user_id: z.string().min(1).max(200),
  purpose_code: z.string().min(1).max(100),
});

const TimelineQuerySchema = z.object({
  external_user_id: z.string().min(1).max(200),
  purpose_code: z.string().min(1).max(100),
  cursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export async function getConsentStatusHandler(req: FastifyRequest, reply: FastifyReply) {
  const companyId = req.companyId;
  if (!companyId) throw req.server.httpErrors.unauthorized("Missing company context.");

  const parsed = StatusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw req.server.httpErrors.badRequest("Invalid query params.");
  }

  const result = await req.server.services.consentQuery.getStatus({
    companyId,
    externalUserId: parsed.data.external_user_id,
    purposeCode: parsed.data.purpose_code,
  });

  if (!result) throw req.server.httpErrors.notFound("Consent not found.");
  return reply.code(200).send(result);
}

export async function getConsentTimelineHandler(req: FastifyRequest, reply: FastifyReply) {
  const companyId = req.companyId;
  if (!companyId) throw req.server.httpErrors.unauthorized("Missing company context.");

  const parsed = TimelineQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw req.server.httpErrors.badRequest("Invalid query params.");
  }

  const result = await req.server.services.consentQuery.getTimeline({
    companyId,
    externalUserId: parsed.data.external_user_id,
    purposeCode: parsed.data.purpose_code,
    cursorVersionNo: parsed.data.cursor,
    limit: parsed.data.limit,
  });

  if (!result) throw req.server.httpErrors.notFound("Consent not found.");
  return reply.code(200).send(result);
}


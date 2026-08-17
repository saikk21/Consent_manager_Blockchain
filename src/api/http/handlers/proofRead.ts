import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";

const ConsentProofQuery = z.object({
  cursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const VerifyBody = z.object({
  leaf_hash: z.string().min(1),
  path_hashes: z.array(z.string().min(1)),
  path_positions: z.array(z.enum(["L", "R"])),
  root_hash: z.string().min(1),
});

export async function getEventProofHandler(req: FastifyRequest, reply: FastifyReply) {
  const eventId = (req.params as { eventId?: string }).eventId;
  if (!eventId) throw req.server.httpErrors.badRequest("Missing eventId.");

  const proof = await req.server.services.proofQuery.getEventProof(eventId);
  if (!proof) throw req.server.httpErrors.notFound("Proof event not found.");
  return reply.code(200).send(proof);
}

export async function getConsentProofsHandler(req: FastifyRequest, reply: FastifyReply) {
  const companyId = req.companyId;
  if (!companyId) throw req.server.httpErrors.unauthorized("Missing company context.");

  const consentId = (req.params as { consentId?: string }).consentId;
  if (!consentId) throw req.server.httpErrors.badRequest("Missing consentId.");

  const query = ConsentProofQuery.safeParse(req.query);
  if (!query.success) throw req.server.httpErrors.badRequest("Invalid pagination query.");

  const result = await req.server.services.proofQuery.getConsentProofs({
    companyId,
    consentId,
    cursorVersionNo: query.data.cursor,
    limit: query.data.limit,
  });
  if (!result) throw req.server.httpErrors.notFound("Consent not found.");
  return reply.code(200).send(result);
}

export async function getProofBatchHandler(req: FastifyRequest, reply: FastifyReply) {
  const batchId = (req.params as { batchId?: string }).batchId;
  if (!batchId) throw req.server.httpErrors.badRequest("Missing batchId.");
  const result = await req.server.services.proofQuery.getBatch(batchId);
  if (!result) throw req.server.httpErrors.notFound("Batch not found.");
  return reply.code(200).send(result);
}

export async function verifyProofHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = VerifyBody.safeParse(req.body);
  if (!parsed.success) throw req.server.httpErrors.badRequest("Invalid verification body.");
  return reply.code(200).send(
    req.server.services.proofQuery.verifyProof({
      leafHash: parsed.data.leaf_hash,
      pathHashes: parsed.data.path_hashes,
      pathPositions: parsed.data.path_positions,
      rootHash: parsed.data.root_hash,
    }),
  );
}


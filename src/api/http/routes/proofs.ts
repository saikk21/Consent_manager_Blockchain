import type { FastifyInstance } from "fastify";
import "../types.js";
import { authApiKeyPlugin } from "../middleware/authApiKey.js";
import {
  getConsentProofsHandler,
  getEventProofHandler,
  getProofBatchHandler,
  verifyProofHandler,
} from "../handlers/proofRead.js";

export async function registerProofRoutes(app: FastifyInstance) {
  await authApiKeyPlugin(app, {});

  app.get("/v1/proofs/events/:eventId", getEventProofHandler);
  app.get("/v1/proofs/consents/:consentId", getConsentProofsHandler);
  app.get("/v1/proofs/batches/:batchId", getProofBatchHandler);
  app.post("/v1/proofs/verify", verifyProofHandler);
}


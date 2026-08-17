import type { FastifyInstance } from "fastify";
import "../types.js";
import { authApiKeyPlugin } from "../middleware/authApiKey.js";
import { makeConsentWriteHandler } from "../handlers/consentWrite.js";
import {
  getConsentStatusHandler,
  getConsentTimelineHandler,
} from "../handlers/consentRead.js";

export async function registerConsentRoutes(app: FastifyInstance) {
  // Apply auth hook in the same route scope.
  await authApiKeyPlugin(app, {});

  app.post("/v1/consents/grant", makeConsentWriteHandler("GRANT"));
  app.post("/v1/consents/update", makeConsentWriteHandler("UPDATE"));
  app.post("/v1/consents/revoke", makeConsentWriteHandler("REVOKE"));
  app.get("/v1/consents/status", getConsentStatusHandler);
  app.get("/v1/consents/timeline", getConsentTimelineHandler);
}


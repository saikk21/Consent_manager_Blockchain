import type { FastifyPluginAsync } from "fastify";
import { withTx } from "../../../persistence/db/tx.js";
import {
  getCompanyByApiKeyHash,
  touchApiKeyLastUsedAt,
} from "../../../persistence/repositories/companyRepository.js";
import { hashApiKey } from "../../../security/apiKeys.js";
import { loadEnv } from "../../../config/env.js";

function parseBearerToken(value: string | undefined): string | null {
  if (!value) return null;

  const [scheme, token] = value.split(" ");

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export const authApiKeyPlugin: FastifyPluginAsync = async (app) => {
  const env = loadEnv();

  app.addHook("preHandler", async (req) => {

    // Allow browser CORS preflight requests
    if (req.method === "OPTIONS") {
      return;
    }

    const cfg = (
      req.routeOptions as {
        config?: { skipApiKeyAuth?: boolean };
      }
    ).config;

    if (cfg?.skipApiKeyAuth) {
      return;
    }

    const rawToken = parseBearerToken(req.headers.authorization);

    if (!rawToken) {
      throw app.httpErrors.unauthorized(
        "Missing or invalid Authorization header. Expected: Bearer <API_KEY>.",
      );
    }

    const apiKeyHash = hashApiKey(
      rawToken,
      env.API_KEY_HASH_PEPPER,
    );

    const company = await withTx(app.pool, async (client) => {
      const resolved = await getCompanyByApiKeyHash(client, {
        apiKeyHash,
      });

      if (resolved) {
        await touchApiKeyLastUsedAt(client, {
          apiKeyHash,
        });
      }

      return resolved;
    });

    if (!company) {
      throw app.httpErrors.unauthorized("Invalid API key.");
    }

    req.companyId = company.id;
  });
};
import type { FastifyInstance } from "fastify";
import "../types.js";
import { z } from "zod";
import { authApiKeyPlugin } from "../middleware/authApiKey.js";

export async function registerPolicyRoutes(app: FastifyInstance) {
  await authApiKeyPlugin(app, {});

  app.post("/v1/policies", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 1) {
      throw app.httpErrors.badRequest("Missing Idempotency-Key header.");
    }

    try {
      const created = await app.services.policy.createDraft(companyId, req.body);
      return reply.code(201).send({
        policyRef: created.policy_ref,
        version: created.version,
        state: created.state,
        policyContentHash: created.policy_content_hash,
        createdAt: created.created_at,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid request";
      throw app.httpErrors.badRequest(msg);
    }
  });

  app.post("/v1/policies/:policyRef/versions/:version/publish", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const idem = req.headers["idempotency-key"];
    if (typeof idem !== "string" || idem.length < 1) {
      throw app.httpErrors.badRequest("Missing Idempotency-Key header.");
    }

    const params = z
      .object({ policyRef: z.string().min(1), version: z.coerce.number().int().positive() })
      .parse(req.params);

    const published = await app.services.policy.publish(companyId, params.policyRef, params.version);
    if (!published) throw app.httpErrors.notFound("Policy version not found.");
    return reply.code(200).send({
      policyRef: published.policy_ref,
      version: published.version,
      state: published.state,
      policyContentHash: published.policy_content_hash,
      publishedAt: published.published_at,
    });
  });

  app.get("/v1/policies/:policyRef/versions/:version", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const params = z
      .object({ policyRef: z.string().min(1), version: z.coerce.number().int().positive() })
      .parse(req.params);
    const query = z.object({ locale: z.string().min(2).max(20).optional() }).parse(req.query);

    const row = await app.services.policy.getVersion(companyId, params.policyRef, params.version, query.locale);
    if (!row) throw app.httpErrors.notFound("Policy version not found.");
    return reply.code(200).send({
      policyRef: row.policy_ref,
      version: row.version,
      state: row.state,
      defaultLocale: row.default_locale,
      requiredLegalVersion: row.required_legal_version,
      policyContentHash: row.policy_content_hash,
      uiSchemaVersion: row.ui_schema_version,
      locale: row.locale,
      renderHash: row.render_hash,
      locales: row.locales,
      publishedAt: row.published_at,
      createdAt: row.created_at,
    });
  });

  app.get("/v1/policies/:policyRef/versions", async (req, reply) => {
    const companyId = req.companyId;
    if (!companyId) throw app.httpErrors.unauthorized("Missing company context.");
    const params = z.object({ policyRef: z.string().min(1) }).parse(req.params);
    const query = z
      .object({
        cursor: z.coerce.number().int().nonnegative().default(0),
        limit: z.coerce.number().int().positive().max(100).default(20),
      })
      .parse(req.query);

    const result = await app.services.policy.listVersions(companyId, params.policyRef, query.cursor, query.limit);
    return reply.code(200).send({
      policyRef: params.policyRef,
      items: result.items.map((r) => ({
        version: r.version,
        state: r.state,
        policyContentHash: r.policy_content_hash,
        publishedAt: r.published_at,
        createdAt: r.created_at,
      })),
      page: result.page,
    });
  });
}


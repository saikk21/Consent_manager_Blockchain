import { z } from "zod";
import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  createWebhookEndpoint,
  getWebhookEndpointById,
  listWebhookEndpoints,
  rotateWebhookEndpointSecret,
  updateWebhookEndpoint,
} from "../../persistence/repositories/webhookRepository.js";
import { generateWebhookSecret } from "../../security/webhookSigning.js";
import { WebhookEventTypes } from "./webhookTypes.js";

const CreateEndpointSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WebhookEventTypes)).min(1),
  environment: z.string().default("dev"),
});

const UpdateEndpointSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum(WebhookEventTypes)).min(1).optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

export class WebhookManagementService {
  constructor(private readonly pool: DbPool) {}

  async createEndpoint(companyId: string, body: unknown) {
    const parsed = CreateEndpointSchema.parse(body);
    const secret = generateWebhookSecret();
    const row = await withTx(this.pool, (client) =>
      createWebhookEndpoint(client, {
        companyId,
        environment: parsed.environment,
        url: parsed.url,
        subscribedEvents: parsed.events,
        signingSecret: secret,
      }),
    );
    return {
      endpointId: row.id,
      url: row.url,
      events: row.subscribed_events,
      environment: row.environment,
      status: row.status,
      signingSecret: secret,
      createdAt: row.created_at,
    };
  }

  async listEndpoints(companyId: string, cursorOffset: number, limit: number) {
    const rows = await withTx(this.pool, (client) =>
      listWebhookEndpoints(client, { companyId, cursorOffset, limit: limit + 1 }),
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? cursorOffset + limit : null;
    return {
      items: items.map((r) => ({
        endpointId: r.id,
        url: r.url,
        events: r.subscribed_events,
        environment: r.environment,
        status: r.status,
        signatureAlgorithm: r.signature_algorithm,
        createdAt: r.created_at,
      })),
      page: { limit, nextCursor, hasMore },
    };
  }

  async rotateSecret(companyId: string, endpointId: string) {
    const secret = generateWebhookSecret();
    const row = await withTx(this.pool, (client) =>
      rotateWebhookEndpointSecret(client, { endpointId, companyId, newSecret: secret }),
    );
    if (!row) return null;
    return {
      endpointId: row.id,
      signingSecret: secret,
      rotatedAt: row.secret_rotated_at,
    };
  }

  async updateEndpoint(companyId: string, endpointId: string, body: unknown) {
    const parsed = UpdateEndpointSchema.parse(body);
    const row = await withTx(this.pool, (client) =>
      updateWebhookEndpoint(client, {
        endpointId,
        companyId,
        status: parsed.status,
        subscribedEvents: parsed.events,
        url: parsed.url,
      }),
    );
    if (!row) return null;
    return {
      endpointId: row.id,
      url: row.url,
      events: row.subscribed_events,
      environment: row.environment,
      status: row.status,
      updatedAt: row.updated_at,
    };
  }

  async getEndpoint(companyId: string, endpointId: string) {
    const row = await withTx(this.pool, (client) =>
      getWebhookEndpointById(client, { endpointId, companyId }),
    );
    if (!row) return null;
    return {
      endpointId: row.id,
      url: row.url,
      events: row.subscribed_events,
      environment: row.environment,
      status: row.status,
      signatureAlgorithm: row.signature_algorithm,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}


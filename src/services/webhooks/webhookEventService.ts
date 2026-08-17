import { randomUUID } from "node:crypto";
import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  createWebhookDeliveryRows,
  selectActiveEndpointsByEventType,
} from "../../persistence/repositories/webhookRepository.js";
import type { WebhookEventType } from "./webhookTypes.js";

export class WebhookEventService {
  constructor(private readonly pool: DbPool) {}

  async enqueueEvent(companyId: string, eventType: WebhookEventType, data: Record<string, unknown>) {
    return withTx(this.pool, async (client) => {
      const endpoints = await selectActiveEndpointsByEventType(client, { companyId, eventType });
      if (endpoints.length === 0) return 0;
      const payload = {
        type: eventType,
        version: 1,
        company_id: companyId,
        occurred_at: new Date().toISOString(),
        data,
      };
      return createWebhookDeliveryRows(client, {
        companyId,
        eventId: randomUUID(),
        eventType,
        payload,
        endpointIds: endpoints.map((e) => e.id),
      });
    });
  }
}


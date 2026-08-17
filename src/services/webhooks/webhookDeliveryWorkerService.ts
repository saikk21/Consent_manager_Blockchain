import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  claimWebhookDeliveries,
  getEndpointById,
  markDeliveryDeadLetter,
  markDeliveryDelivered,
  requeueDelivery,
} from "../../persistence/repositories/webhookRepository.js";
import { signWebhookPayload } from "../../security/webhookSigning.js";

function computeBackoff(attempt: number): number {
  const baseMs = 2000;
  const capMs = 300000;
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.max(1, exp * 0.2));
  return exp + jitter;
}

function classifyRetryable(statusCode: number | null, err: unknown): boolean {
  if (err) return true;
  if (statusCode == null) return true;
  if (statusCode >= 500) return true;
  if (statusCode === 429) return true;
  return false;
}

export class WebhookDeliveryWorkerService {
  constructor(private readonly pool: DbPool) {}

  async processNext(limit = 100): Promise<number> {
    const deliveries = await withTx(this.pool, (client) => claimWebhookDeliveries(client, { limit }));
    if (deliveries.length === 0) return 0;

    let processed = 0;
    for (const delivery of deliveries) {
      const endpoint = await withTx(this.pool, (client) =>
        getEndpointById(client, { endpointId: delivery.endpoint_id }),
      );
      if (!endpoint || endpoint.status !== "ACTIVE") {
        await withTx(this.pool, (client) =>
          markDeliveryDeadLetter(client, {
            deliveryId: delivery.id,
            errorMessage: "Endpoint missing or inactive.",
            signatureHeader: "",
            signatureTimestamp: Math.floor(Date.now() / 1000),
          }),
        );
        continue;
      }

      const ts = Math.floor(Date.now() / 1000);
      const signed = signWebhookPayload(delivery.payload, endpoint.signing_secret, ts);
      let statusCode: number | null = null;
      let errText: string | null = null;
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-sammati-signature": signed.header,
            "x-sammati-timestamp": String(signed.timestamp),
            "x-sammati-delivery-id": delivery.id,
            "x-sammati-event-id": delivery.event_id,
            "x-sammati-event-type": delivery.event_type,
          },
          body: signed.body,
        });
        statusCode = response.status;
      } catch (e) {
        errText = e instanceof Error ? e.message : "Unknown webhook delivery error";
      }

      const success = statusCode != null && statusCode >= 200 && statusCode < 300;
      if (success) {
        await withTx(this.pool, (client) =>
          markDeliveryDelivered(client, {
            deliveryId: delivery.id,
            signatureHeader: signed.header,
            signatureTimestamp: signed.timestamp,
            httpStatus: statusCode!,
          }),
        );
        processed += 1;
        continue;
      }

      const retryable = classifyRetryable(statusCode, errText);
      const reason = errText ?? `HTTP ${statusCode ?? "unknown"}`;
      if (!retryable || delivery.attempt_count >= delivery.max_attempts) {
        await withTx(this.pool, (client) =>
          markDeliveryDeadLetter(client, {
            deliveryId: delivery.id,
            errorMessage: reason,
            httpStatus: statusCode,
            signatureHeader: signed.header,
            signatureTimestamp: signed.timestamp,
          }),
        );
      } else {
        const next = new Date(Date.now() + computeBackoff(delivery.attempt_count));
        await withTx(this.pool, (client) =>
          requeueDelivery(client, {
            deliveryId: delivery.id,
            nextAttemptAt: next,
            errorMessage: reason,
            httpStatus: statusCode,
            signatureHeader: signed.header,
            signatureTimestamp: signed.timestamp,
          }),
        );
      }
    }
    return processed;
  }
}


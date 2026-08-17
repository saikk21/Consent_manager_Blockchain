import { createHash } from "node:crypto";
import type { CompanyId } from "../../domain/consent/types.js";
import type { DbClient } from "../../persistence/db/pool.js";
import {
  getIdempotencyRowForUpdate,
  insertIdempotencyInProgress,
  type IdempotencyRow,
} from "../../persistence/repositories/idempotencyRepository.js";
import { DomainError } from "../../domain/consent/lifecycle.js";

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableJsonStringify(obj[k])).join(",")}}`;
}

export function computeRequestHash(input: unknown): string {
  const canonical = stableJsonStringify(input);
  return createHash("sha256").update(canonical).digest("hex");
}

export type IdempotencyReserveResult =
  | { kind: "NEW"; row: IdempotencyRow }
  | { kind: "REPLAY"; row: IdempotencyRow }
  | { kind: "IN_PROGRESS"; row: IdempotencyRow };

export async function reserveIdempotencyKey(
  client: DbClient,
  input: Readonly<{
    companyId: CompanyId;
    idempotencyKey: string;
    requestHash: string;
    ttlSeconds: number;
    now: Date;
  }>,
): Promise<IdempotencyReserveResult> {
  const existing = await getIdempotencyRowForUpdate(client, {
    companyId: input.companyId,
    idempotencyKey: input.idempotencyKey,
  });

  if (!existing) {
    const expiresAt = new Date(input.now.getTime() + input.ttlSeconds * 1000);
    const row = await insertIdempotencyInProgress(client, {
      companyId: input.companyId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      expiresAt: expiresAt.toISOString(),
    });
    return { kind: "NEW", row };
  }

  if (existing.request_hash !== input.requestHash) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Idempotency-Key reuse with different request payload.",
      { idempotencyKey: input.idempotencyKey },
    );
  }

  if (existing.status === "COMPLETED") return { kind: "REPLAY", row: existing };
  return { kind: "IN_PROGRESS", row: existing };
}


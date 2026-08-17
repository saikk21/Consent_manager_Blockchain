import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableJsonStringify(obj[k])).join(",")}}`;
}

export function canonicalWebhookPayload(payload: unknown): string {
  return stableJsonStringify(payload);
}

export function signWebhookPayload(
  payload: unknown,
  secret: string,
  timestamp: number,
): { signature: string; header: string; timestamp: number; body: string } {
  const body = canonicalWebhookPayload(payload);
  const signed = `${timestamp}.${body}`;
  const signature = createHmac("sha256", secret).update(signed).digest("hex");
  return {
    signature,
    header: `t=${timestamp},v1=${signature}`,
    timestamp,
    body,
  };
}

export function verifyWebhookSignature(input: Readonly<{
  payload: unknown;
  header: string;
  secret: string;
  maxAgeSeconds: number;
  nowEpochSeconds?: number;
}>): boolean {
  const entries = new Map(
    input.header.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [(k ?? "").trim(), (v ?? "").trim()];
    }),
  );
  const t = Number(entries.get("t"));
  const v1 = entries.get("v1") ?? "";
  if (!Number.isFinite(t) || !v1) return false;
  const now = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > input.maxAgeSeconds) return false;

  const expected = signWebhookPayload(input.payload, input.secret, t).signature;
  const lhs = Buffer.from(v1);
  const rhs = Buffer.from(expected);
  if (lhs.length !== rhs.length) return false;
  return timingSafeEqual(lhs, rhs);
}


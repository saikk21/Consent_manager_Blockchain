import { createHmac, timingSafeEqual } from "node:crypto";
import { SammatiError } from "@sammati/shared-core";

export type ParsedWebhookSignatureHeader = Readonly<{
  timestamp: number;
  signatures: string[];
}>;

export type VerifyWebhookSignatureInput = Readonly<{
  signatureHeader: string;
  rawBody: string;
  secrets: string[];
  toleranceSeconds?: number;
  nowEpochSeconds?: number;
}>;

export type VerifyWebhookSignatureResult = Readonly<
  | {
      ok: true;
      timestamp: number;
      matchedSecretIndex: number;
    }
  | {
      ok: false;
      reason:
        | "malformed_header"
        | "invalid_timestamp"
        | "replay_window_exceeded"
        | "signature_mismatch";
    }
>;

export function parseWebhookSignatureHeader(header: string): ParsedWebhookSignatureHeader {
  const entries = header
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.split("=");
      return { key: (key ?? "").trim(), value: rest.join("=").trim() };
    });

  const timestampEntry = entries.find((entry) => entry.key === "t");
  const signatures = entries
    .filter((entry) => entry.key === "v1")
    .map((entry) => entry.value)
    .filter(Boolean);

  if (!timestampEntry || signatures.length === 0) {
    throw new SammatiError({
      type: "validation",
      message: "Malformed webhook signature header. Expected: t=<epoch>,v1=<hmac>",
      details: { header },
    });
  }
  const timestamp = Number(timestampEntry.value);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    throw new SammatiError({
      type: "validation",
      message: "Invalid webhook signature timestamp.",
      details: { timestamp: timestampEntry.value },
    });
  }
  return { timestamp, signatures };
}

export function computeWebhookSignature(input: Readonly<{
  timestamp: number;
  rawBody: string;
  secret: string;
}>): string {
  return createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");
}

function constantTimeHexCompare(left: string, right: string): boolean {
  const lhs = Buffer.from(left, "utf8");
  const rhs = Buffer.from(right, "utf8");
  if (lhs.length !== rhs.length) return false;
  return timingSafeEqual(lhs, rhs);
}

export function verifyWebhookSignature(
  input: VerifyWebhookSignatureInput,
): VerifyWebhookSignatureResult {
  let parsed: ParsedWebhookSignatureHeader;
  try {
    parsed = parseWebhookSignatureHeader(input.signatureHeader);
  } catch {
    return { ok: false, reason: "malformed_header" };
  }

  const now = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(now) || now <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { ok: false, reason: "replay_window_exceeded" };
  }

  for (let i = 0; i < input.secrets.length; i += 1) {
    const secret = input.secrets[i]!;
    const expected = computeWebhookSignature({
      timestamp: parsed.timestamp,
      rawBody: input.rawBody,
      secret,
    });
    for (const provided of parsed.signatures) {
      if (constantTimeHexCompare(expected, provided)) {
        return {
          ok: true,
          timestamp: parsed.timestamp,
          matchedSecretIndex: i,
        };
      }
    }
  }

  return { ok: false, reason: "signature_mismatch" };
}

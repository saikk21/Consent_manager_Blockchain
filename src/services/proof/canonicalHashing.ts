import { createHash } from "node:crypto";

export type ProofEventCanonicalInput = Readonly<{
  eventId: string;
  companyId: string;
  consentId: string;
  externalUserId: string;
  purposeCode: string;
  eventType: string;
  versionNo: number;
  policyRef: string;
  occurredAt: string;
  recordedAt: string;
  eventHash: string;
}>;

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableJsonStringify(obj[k])).join(",")}}`;
}

export function computeLeafHash(input: ProofEventCanonicalInput): string {
  const canonical = stableJsonStringify(input);
  return createHash("sha256").update(`sammati.leaf.v1:${canonical}`).digest("hex");
}


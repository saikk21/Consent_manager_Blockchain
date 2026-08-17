import { createHash } from "node:crypto";
import type {
  CompanyId,
  ConsentEventType,
  ConsentId,
  ExternalUserId,
  PolicyRef,
  PurposeCode,
  VersionNo,
} from "./types.js";

export type EventHashInput = Readonly<{
  companyId: CompanyId;
  consentId: ConsentId;
  externalUserId: ExternalUserId;
  purposeCode: PurposeCode;
  eventType: ConsentEventType;
  versionNo: VersionNo;
  policyRef: PolicyRef;
  occurredAt: string; // ISO
  recordedAt: string; // ISO
}>;

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableJsonStringify(obj[k])).join(",")}}`;
}

export function computeEventHash(input: EventHashInput): string {
  const canonical = stableJsonStringify(input);
  return createHash("sha256").update(canonical).digest("hex");
}


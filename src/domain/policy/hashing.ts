import { createHash } from "node:crypto";

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableJsonStringify(obj[k])).join(",")}}`;
}

export type PolicyHashInput = Readonly<{
  companyId: string;
  policyRef: string;
  version: number;
  defaultLocale: string;
  requiredLegalVersion: string;
  locales: unknown; // validated content model
  uiSchemaVersion: number;
}>;

export function computePolicyContentHash(input: PolicyHashInput): string {
  const canonical = stableJsonStringify({
    companyId: input.companyId,
    policyRef: input.policyRef,
    version: input.version,
    defaultLocale: input.defaultLocale,
    requiredLegalVersion: input.requiredLegalVersion,
    locales: input.locales,
    uiSchemaVersion: input.uiSchemaVersion,
  });
  return createHash("sha256").update(`sammati.policy.v1:${canonical}`).digest("hex");
}

export function computeRenderHash(input: Readonly<{
  policyContentHash: string;
  locale: string;
  requiredLegalVersion: string;
  uiSchemaVersion: number;
}>): string {
  const canonical = stableJsonStringify({
    policyContentHash: input.policyContentHash,
    locale: input.locale,
    requiredLegalVersion: input.requiredLegalVersion,
    uiSchemaVersion: input.uiSchemaVersion,
  });
  return createHash("sha256").update(`sammati.render.v1:${canonical}`).digest("hex");
}


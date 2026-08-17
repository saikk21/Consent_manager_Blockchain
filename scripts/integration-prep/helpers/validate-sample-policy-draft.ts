import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreatePolicyDraftSchema,
  validateRequiredSections,
} from "../../../src/domain/policy/validation.js";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, "../examples/payloads/sample-newsletter-policy-v1-draft.json");
const raw: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
const parsed = CreatePolicyDraftSchema.parse(raw);
validateRequiredSections(parsed.locales as Record<string, any>);
// eslint-disable-next-line no-console
console.log(
  "OK —",
  parsed.policyRef,
  "v" + String(parsed.version),
  "locale",
  parsed.defaultLocale,
  "(file:",
  jsonPath + ")",
);

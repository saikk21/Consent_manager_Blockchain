import { z } from "zod";

export const RequiredPolicySectionIds = [
  "purpose",
  "data_categories",
  "processing",
  "retention",
  "withdrawal",
  "grievance",
] as const;

export const PolicySectionSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(20_000),
});

export const PolicyLocaleContentSchema = z.object({
  title: z.string().min(1).max(300),
  sections: z.array(PolicySectionSchema).min(1),
});

export const PolicyLocalesSchema = z
  .record(z.string().min(2).max(20), PolicyLocaleContentSchema)
  .refine((locales) => Object.keys(locales).length > 0, "At least one locale is required.");

export const CreatePolicyDraftSchema = z.object({
  policyRef: z.string().min(1).max(200),
  version: z.number().int().positive(),
  defaultLocale: z.string().min(2).max(20),
  requiredLegalVersion: z.string().min(1).max(50),
  locales: PolicyLocalesSchema,
  uiSchemaVersion: z.number().int().positive().default(1),
});

export type CreatePolicyDraftInput = z.infer<typeof CreatePolicyDraftSchema>;

export function validateRequiredSections(locales: Record<string, any>) {
  for (const [locale, content] of Object.entries(locales)) {
    const ids = new Set((content.sections ?? []).map((s: any) => s.id));
    for (const required of RequiredPolicySectionIds) {
      if (!ids.has(required)) {
        throw new Error(`Locale ${locale} missing required policy section: ${required}`);
      }
    }
  }
}


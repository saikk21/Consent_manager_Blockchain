import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY_HASH_PEPPER: z.string().default(""),
  WIDGET_SESSION_SIGNING_KID: z.string().default("wsk-dev-1"),
  WIDGET_SESSION_SIGNING_KEY: z.string().default("dev-widget-session-signing-key"),
  WIDGET_SESSION_SIGNING_KEYS_JSON: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}


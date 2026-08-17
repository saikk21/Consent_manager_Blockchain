import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "smm_live";

export type GeneratedApiKey = Readonly<{
  rawApiKey: string;
  publicPrefix: string;
  keyHash: string;
}>;

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function hashApiKey(rawApiKey: string, pepper = ""): string {
  return createHash("sha256").update(`${pepper}:${rawApiKey}`).digest("hex");
}

export function generateApiKey(pepper = ""): GeneratedApiKey {
  const secret = toBase64Url(randomBytes(32));
  const rawApiKey = `${API_KEY_PREFIX}_${secret}`;
  const publicPrefix = rawApiKey.slice(0, 18);
  const keyHash = hashApiKey(rawApiKey, pepper);

  return {
    rawApiKey,
    publicPrefix,
    keyHash,
  };
}


import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { loadEnv } from "../config/env.js";

type WidgetSigningKey = Readonly<{ kid: string; secret: string }>;

export type WidgetSessionClaims = Readonly<{
  iss: "sammati";
  aud: "sammati-widget";
  jti: string;
  company_id: string;
  environment: string;
  external_user_id: string;
  purpose_code: string;
  policy_ref: string;
  policy_version: number;
  locale: string;
  allowed_origin: string;
  render_hash: string;
  nonce: string;
  iat: number;
  exp: number;
}>;

type JwsHeader = Readonly<{
  alg: "HS256";
  typ: "JWT";
  kid: string;
}>;

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

function parseSigningKeys(): WidgetSigningKey[] {
  const env = loadEnv();
  if (env.WIDGET_SESSION_SIGNING_KEYS_JSON) {
    const parsed = JSON.parse(env.WIDGET_SESSION_SIGNING_KEYS_JSON) as Record<string, string>;
    return Object.entries(parsed).map(([kid, secret]) => ({ kid, secret }));
  }
  return [{ kid: env.WIDGET_SESSION_SIGNING_KID, secret: env.WIDGET_SESSION_SIGNING_KEY }];
}

function sign(input: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(input).digest());
}

export function createWidgetSessionNonce() {
  return randomUUID();
}

export function generateWidgetSessionToken(claims: WidgetSessionClaims): string {
  const keys = parseSigningKeys();
  const active = keys[0];
  if (!active) throw new Error("No widget session signing key configured.");

  const header: JwsHeader = {
    alg: "HS256",
    typ: "JWT",
    kid: active.kid,
  };
  const encHeader = toBase64Url(JSON.stringify(header));
  const encClaims = toBase64Url(JSON.stringify(claims));
  const signature = sign(`${encHeader}.${encClaims}`, active.secret);
  return `${encHeader}.${encClaims}.${signature}`;
}

export function verifyWidgetSessionToken(
  token: string,
  options?: Readonly<{ allowExpired?: boolean }>,
): WidgetSessionClaims {
  const keys = parseSigningKeys();
  const [encHeader, encClaims, encSig] = token.split(".");
  if (!encHeader || !encClaims || !encSig) {
    throw new Error("Invalid widget session token format.");
  }

  const header = JSON.parse(fromBase64Url(encHeader).toString("utf8")) as JwsHeader;
  if (header.alg !== "HS256") throw new Error("Unsupported widget session token algorithm.");

  const key = keys.find((k) => k.kid === header.kid);
  if (!key) throw new Error("Unknown widget session token kid.");

  const expectedSig = sign(`${encHeader}.${encClaims}`, key.secret);
  const lhs = Buffer.from(encSig);
  const rhs = Buffer.from(expectedSig);
  if (lhs.length !== rhs.length || !timingSafeEqual(lhs, rhs)) {
    throw new Error("Invalid widget session token signature.");
  }

  const claims = JSON.parse(fromBase64Url(encClaims).toString("utf8")) as WidgetSessionClaims;
  const now = Math.floor(Date.now() / 1000);
  if (!options?.allowExpired && claims.exp <= now) throw new Error("Widget session token expired.");
  if (claims.iss !== "sammati" || claims.aud !== "sammati-widget") {
    throw new Error("Invalid widget session token claims.");
  }
  return claims;
}


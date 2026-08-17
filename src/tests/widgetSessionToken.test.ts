import { strict as assert } from "node:assert";
import {
  generateWidgetSessionToken,
  verifyWidgetSessionToken,
} from "../security/widgetSessionToken.js";

function run() {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "sammati" as const,
    aud: "sammati-widget" as const,
    jti: "11111111-1111-1111-1111-111111111111",
    company_id: "c1",
    environment: "dev",
    external_user_id: "u1",
    purpose_code: "KYC",
    policy_ref: "kyc-consent",
    policy_version: 1,
    locale: "en-IN",
    allowed_origin: "https://app.example.com",
    render_hash: "abc",
    nonce: "n1",
    iat: now,
    exp: now + 60,
  };

  const token = generateWidgetSessionToken(claims);
  const verified = verifyWidgetSessionToken(token);
  assert.equal(verified.jti, claims.jti);
  assert.equal(verified.allowed_origin, claims.allowed_origin);

  const expired = generateWidgetSessionToken({
    ...claims,
    jti: "22222222-2222-2222-2222-222222222222",
    exp: now - 10,
  });
  let expiredThrown = false;
  try {
    verifyWidgetSessionToken(expired);
  } catch {
    expiredThrown = true;
  }
  assert.equal(expiredThrown, true, "expired token must fail");

  // eslint-disable-next-line no-console
  console.log("widget session token tests passed");
}

run();


import { describe, expect, it } from "vitest";
import {
  computeWebhookSignature,
  parseWebhookSignatureHeader,
  verifyWebhookSignature,
} from "../src/index.js";

describe("webhook-utils signature verification", () => {
  const secret = "whsec_test_1";
  const previousSecret = "whsec_test_0";
  const rawBody = '{"type":"consent.recorded","version":1}';
  const timestamp = 1_778_000_000;

  it("verifies valid signature", () => {
    const sig = computeWebhookSignature({ timestamp, rawBody, secret });
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${sig}`,
      rawBody,
      secrets: [secret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({
      ok: true,
      timestamp,
      matchedSecretIndex: 0,
    });
  });

  it("rejects invalid signature", () => {
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=deadbeef`,
      rawBody,
      secrets: [secret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects tampered payload", () => {
    const sig = computeWebhookSignature({ timestamp, rawBody, secret });
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${sig}`,
      rawBody: '{"type":"consent.recorded","version":999}',
      secrets: [secret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("rejects stale timestamp by replay window", () => {
    const sig = computeWebhookSignature({ timestamp, rawBody, secret });
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${sig}`,
      rawBody,
      secrets: [secret],
      toleranceSeconds: 60,
      nowEpochSeconds: timestamp + 120,
    });
    expect(result).toEqual({ ok: false, reason: "replay_window_exceeded" });
  });

  it("rejects malformed header", () => {
    const result = verifyWebhookSignature({
      signatureHeader: "bad-header",
      rawBody,
      secrets: [secret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({ ok: false, reason: "malformed_header" });
  });

  it("accepts rotated secrets", () => {
    const sigWithPrevious = computeWebhookSignature({
      timestamp,
      rawBody,
      secret: previousSecret,
    });
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${sigWithPrevious}`,
      rawBody,
      secrets: [secret, previousSecret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({
      ok: true,
      timestamp,
      matchedSecretIndex: 1,
    });
  });

  it("parses header with multiple v1 signatures", () => {
    const sigA = computeWebhookSignature({ timestamp, rawBody, secret });
    const sigB = computeWebhookSignature({ timestamp, rawBody, secret: previousSecret });
    const parsed = parseWebhookSignatureHeader(`t=${timestamp},v1=${sigA},v1=${sigB}`);
    expect(parsed.timestamp).toBe(timestamp);
    expect(parsed.signatures).toEqual([sigA, sigB]);
  });

  it("constant-time compare path rejects length mismatch", () => {
    const sig = computeWebhookSignature({ timestamp, rawBody, secret });
    const shortSig = sig.slice(0, -1);
    const result = verifyWebhookSignature({
      signatureHeader: `t=${timestamp},v1=${shortSig}`,
      rawBody,
      secrets: [secret],
      toleranceSeconds: 300,
      nowEpochSeconds: timestamp + 10,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });
});

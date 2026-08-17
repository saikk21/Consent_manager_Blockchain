# Phase D.1b Webhook Utils MVP

## Scope

Implemented package: `@sammati/webhook-utils`

Included helpers:

- `parseWebhookSignatureHeader(header)`
- `computeWebhookSignature({ timestamp, rawBody, secret })`
- `verifyWebhookSignature({ signatureHeader, rawBody, secrets, toleranceSeconds, nowEpochSeconds })`

This package is framework/runtime agnostic and does not depend on Fastify/Express adapters.

## Signature contract compatibility (Phase C.3)

Compatible with C.3 header format:

- `x-sammati-signature: t=<epoch_seconds>,v1=<hex_hmac>`
- Signed string: `<timestamp>.<raw_body>`
- Algorithm: `HMAC SHA-256`

## Usage example

```ts
import { verifyWebhookSignature } from "@sammati/webhook-utils";

const result = verifyWebhookSignature({
  signatureHeader: req.headers["x-sammati-signature"] ?? "",
  rawBody,
  secrets: [currentSecret, previousSecret],
  toleranceSeconds: 300,
});

if (!result.ok) {
  // reject request
}
```

## Replay-window semantics

- Compare `abs(now - timestamp)` against `toleranceSeconds`
- Default tolerance is 300 seconds if not provided
- Exceeding tolerance returns:
  - `{ ok: false, reason: "replay_window_exceeded" }`

## Secret rotation guidance

- Pass secrets in priority order: `[currentSecret, previousSecret]`
- Verification succeeds if any provided secret matches
- `matchedSecretIndex` indicates which secret matched for observability

## Express/Fastify-neutral note

- Inputs are plain strings/arrays/numbers
- Callers are responsible for providing the **raw request body**
- No framework-specific request/response types are used


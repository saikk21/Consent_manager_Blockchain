# Phase C.3 Webhook Signature Spec

## Algorithm

- `HMAC SHA-256`
- Version marker: `v1`
- Canonical payload format: deterministic JSON with sorted object keys

## Signed String

Server computes:

`<timestamp>.<canonical_json_payload>`

Then signs with endpoint secret `whsec_*`.

## Headers

- `x-sammati-signature: t=<epoch_seconds>,v1=<hex_hmac>`
- `x-sammati-timestamp: <epoch_seconds>`
- `x-sammati-delivery-id: <uuid>`
- `x-sammati-event-id: <uuid>`
- `x-sammati-event-type: <event_type>`

## Replay Protection

Consumer must reject requests when timestamp drift is beyond tolerance (recommended: 300 seconds).

Verification steps:

1. Parse `t` and `v1`.
2. Reject if timestamp outside tolerance.
3. Recompute HMAC on `<t>.<canonical_payload>`.
4. Compare using constant-time equality.

## Verification example (Node.js)

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(headers, rawBody, secret, maxSkewSeconds = 300) {
  const sig = headers["x-sammati-signature"] || "";
  const m = /t=(\d+),v1=([a-f0-9]+)/.exec(sig);
  if (!m) return false;
  const t = Number(m[1]);
  const v1 = m[2];
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > maxSkewSeconds) return false; // replay-window rejection

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Invalid signature behavior:

- Tampered body -> recomputed HMAC mismatch -> reject
- Wrong secret -> recomputed HMAC mismatch -> reject
- Stale timestamp -> replay-window reject before compare

## Secret Rotation

- Endpoint keeps `signing_secret` and `previous_signing_secret`.
- During rotation window, consumer may verify against both.
- New deliveries are always signed with current `signing_secret`.


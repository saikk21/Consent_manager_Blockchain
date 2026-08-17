# Phase D.1c Server SDK MVP

## Scope

Implemented package: `@sammati/server-sdk`

Minimal API surface:

- `createSammatiClient(config)`
- `client.widgetSessions.create(...)`
- `client.widgetSessions.get(...)`
- `client.widgetSessions.submit(...)`
- `client.widgetRuntime.bootstrap(...)`
- `client.webhooks.createEndpoint(...)`
- `client.webhooks.listEndpoints(...)`

No proof/policy/admin/analytics APIs are included in D.1c.

## Quick usage

```ts
import { createSammatiClient } from "@sammati/server-sdk";

const client = createSammatiClient({
  baseUrl: "http://127.0.0.1:3000",
  apiKey: process.env.SAMMATI_API_KEY!,
  timeoutMs: 5000,
});

const created = await client.webhooks.createEndpoint({
  url: "https://example.com/webhook",
  events: ["consent.recorded"],
});

const listed = await client.webhooks.listEndpoints({ cursor: 0, limit: 20 });
```

## Retry/idempotency semantics

- Retries apply only to transient failures (`network`, `timeout`, `server`, `rate_limit`).
- GET requests can be retried safely.
- POST retries require idempotency safety; SDK auto-generates idempotency key for write APIs that require it.
- Retry defaults are intentionally small and configurable.

## Local smoke testing

Run integration smoke test with env:

- `SAMMATI_BASE_URL=http://127.0.0.1:3000`
- `SAMMATI_API_KEY=<raw_api_key>`

Then:

```bash
npm run --workspace @sammati/server-sdk test
```

The smoke test is auto-skipped when env vars are missing.

## Compatibility notes

- Uses existing frozen C.2/C.3/C.4 API endpoints and payload contracts.
- `widgetRuntime.bootstrap` and `widgetSessions.submit` remain session-token driven as per runtime contract.


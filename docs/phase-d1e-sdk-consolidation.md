# Phase D.1e SDK Consolidation Freeze

## Consolidated package map

- `@sammati/shared-core`: shared transport, errors, common types
- `@sammati/webhook-utils`: webhook signature verification helpers
- `@sammati/server-sdk`: minimal typed backend SDK methods
- `@sammati/widget-sdk`: minimal browser embed/listener helpers

## Package dependency diagram

```text
@sammati/shared-core
  ├── @sammati/webhook-utils
  ├── @sammati/server-sdk
  └── @sammati/widget-sdk
```

No package cross-dependencies are allowed beyond shared-core.

## Installation and local development

From repository root:

```bash
npm install
npm run build:packages
npm run test:packages
```

## End-to-end minimal developer flow

1. **Backend**: create widget session with `@sammati/server-sdk`
2. **Browser**: build hosted iframe URL with `@sammati/widget-sdk`
3. **Browser**: mount iframe and subscribe to runtime events
4. **Backend**: verify webhook signatures with `@sammati/webhook-utils`

## Minimal backend integration example

```ts
import { createSammatiClient } from "@sammati/server-sdk";

const client = createSammatiClient({
  baseUrl: "http://127.0.0.1:3000",
  apiKey: process.env.SAMMATI_API_KEY!,
});

const session = await client.widgetSessions.create({
  external_user_id: "u1",
  purpose_code: "KYC",
  policy_ref: "kyc-consent",
  policy_version: 1,
  locale: "en-IN",
  allowed_origin: "https://app.example.com",
});
```

## Minimal iframe embed example

```ts
import {
  buildHostedWidgetUrl,
  mountWidgetIframe,
  createWidgetListener,
} from "@sammati/widget-sdk";

const url = buildHostedWidgetUrl({
  baseUrl: "https://sammati.example.com",
  sessionToken: session.token.sessionToken,
});

const mounted = mountWidgetIframe({
  container: document.getElementById("consent-slot")!,
  url,
});

const listener = createWidgetListener({
  allowedOrigin: "https://sammati.example.com",
  onEvent: (event) => console.log(event.event, event.payload),
});
```

## Minimal webhook verification example

```ts
import { verifyWebhookSignature } from "@sammati/webhook-utils";

const verified = verifyWebhookSignature({
  signatureHeader: req.headers["x-sammati-signature"] ?? "",
  rawBody,
  secrets: [process.env.WEBHOOK_SECRET!, process.env.WEBHOOK_SECRET_PREV!].filter(Boolean),
  toleranceSeconds: 300,
});

if (!verified.ok) throw new Error(`Webhook rejected: ${verified.reason}`);
```

## Local sandbox workflow

1. Start API and workers (`npm run dev`, `npm run worker:proof`, `npm run worker:anchor-mock`, `npm run worker:webhook`)
2. Bootstrap company and API key (`npm run company:bootstrap`)
3. Create/publish policy via existing API
4. Create session via server-sdk
5. Embed widget via widget-sdk
6. Validate signed webhooks via webhook-utils


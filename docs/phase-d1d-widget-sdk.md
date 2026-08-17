# Phase D.1d Widget SDK MVP

## Scope

Implemented package: `@sammati/widget-sdk`

Minimal helper APIs:

- `buildHostedWidgetUrl({ baseUrl, sessionToken })`
- `mountWidgetIframe({ container, url, iframeAttrs?, onResize? })`
- `createWidgetListener({ allowedOrigin, onEvent })`

No UI component abstractions, framework wrappers, or frontend apps are included.

## Quick usage

```ts
import {
  buildHostedWidgetUrl,
  mountWidgetIframe,
  createWidgetListener,
} from "@sammati/widget-sdk";

const url = buildHostedWidgetUrl({
  baseUrl: "https://sammati.example.com",
  sessionToken,
});

const mounted = mountWidgetIframe({
  container: document.getElementById("consent-slot")!,
  url,
  onResize: (height) => {
    console.log("widget height", height);
  },
});

const listener = createWidgetListener({
  allowedOrigin: "https://sammati.example.com",
  onEvent: (event) => {
    if (event.event === "consent.submitted") {
      console.log("submitted", event.payload);
    }
  },
});

// later:
listener.dispose();
mounted.dispose();
```

## Security guidance

- Always set `allowedOrigin` to the exact Sammati host.
- Do not accept wildcard origins.
- Use hosted URL from trusted `baseUrl` and backend-issued session token only.
- Keep iframe sandbox defaults unless you have a reviewed reason to override.

## C.4 postMessage compatibility

Listener accepts only frozen C.4 message contracts:

- `widget.ready`
- `widget.loaded`
- `widget.resized`
- `consent.submitted`
- `consent.failed`
- `widget.error`

Messages with wrong origin/version/schema are ignored.


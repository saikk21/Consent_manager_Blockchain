# Phase D.1e Compatibility and Versioning

**Release coordination:** Cross-package versioning, Git tags, and publish order are defined in [Phase E.1a.1 release policy](phase-e1a1-release-policy.md).

## SemVer policy

- **Major**: breaking SDK API/behavior changes
- **Minor**: additive APIs/options/types and non-breaking enhancements
- **Patch**: bugfixes and internal hardening only

## Compatibility guarantees

- SDKs target frozen platform contracts from Phases C.2/C.3/C.4.
- Additive response fields are treated as non-breaking.
- Existing typed fields and semantics are preserved within major versions.

## Runtime support assumptions

- **Node packages** (`server-sdk`, `webhook-utils`):
  - modern Node runtime with `fetch` and `crypto` support
- **Browser package** (`widget-sdk`):
  - modern browsers with `postMessage`, iframe, and URL APIs

## ESM/CJS compatibility

- All packages emit:
  - ESM (`dist/index.js`)
  - CJS (`dist/index.cjs`)
  - typings (`dist/index.d.ts`)
- `exports` map is explicit and top-level only.

## postMessage compatibility

- Widget listener accepts frozen C.4 messages only:
  - `version: "1.0"`
  - approved event names
- Unknown versions/events are ignored for forward safety.

## Webhook signature compatibility

- C.3 signature format:
  - `t=<epoch_seconds>,v1=<hex_hmac>`
- Signed string:
  - `<timestamp>.<raw_body>`
- Rotation model:
  - verify against current + previous secrets


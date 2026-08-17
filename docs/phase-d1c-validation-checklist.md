# Phase D.1c Validation Checklist

## Build and type safety

- [ ] `@sammati/shared-core` builds cleanly
- [ ] `@sammati/server-sdk` builds cleanly
- [ ] `@sammati/server-sdk` typecheck passes
- [ ] ESM/CJS + d.ts outputs emitted

## Contract tests

- [ ] Auth header injection for secured endpoints
- [ ] Public endpoint behavior (`widgetRuntime.bootstrap`) without API auth
- [ ] Automatic idempotency key generation for write methods
- [ ] Retry behavior for transient errors
- [ ] No retry for non-transient validation errors
- [ ] Unknown error normalization to shared-core `SammatiError`

## Integration smoke

- [ ] Local API smoke test passes when env vars are set
- [ ] Test auto-skips safely without env vars

## Scope guardrails

- [ ] No widget-sdk helper implementation added
- [ ] No proof/policy/admin/analytics SDK API surface added
- [ ] No framework-specific adapters added


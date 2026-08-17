# Phase D.1d Validation Checklist

## Build and typing

- [ ] `@sammati/widget-sdk` builds cleanly
- [ ] `@sammati/widget-sdk` typecheck passes
- [ ] ESM/CJS + d.ts output is emitted
- [ ] No Node/server-only runtime imports in widget package

## Tests

- [ ] Hosted widget URL helper deterministic output
- [ ] iframe mount default security attrs
- [ ] dispose/unmount cleanup works
- [ ] strict origin rejection in listener
- [ ] valid postMessage acceptance
- [ ] invalid schema/version rejection
- [ ] resize callback handling

## Scope guardrails

- [ ] No framework wrappers (React/Vue/etc.)
- [ ] No UI component library abstractions
- [ ] No dashboard/admin frontend work
- [ ] No server-sdk API expansion


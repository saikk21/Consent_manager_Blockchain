# Phase D.1e Validation Checklist

## Documentation consolidation

- [ ] server-sdk docs reviewed and aligned with current API
- [ ] widget-sdk docs reviewed and aligned with current helpers
- [ ] webhook-utils docs reviewed and aligned with C.3 signatures
- [ ] installation + local development instructions consolidated
- [ ] end-to-end quickstart flow documented

## Compatibility and versioning

- [ ] SemVer policy documented
- [ ] Node/browser runtime assumptions documented
- [ ] postMessage compatibility documented
- [ ] webhook signature compatibility documented

## Publishing readiness

- [ ] package metadata complete (`main/module/types/exports/files`)
- [ ] typings emit successfully for all packages
- [ ] ESM/CJS output verified
- [ ] tree-shaking flag (`sideEffects: false`) set where appropriate
- [ ] no accidental internal export leakage

## Integration validation

- [ ] `npm run build:packages` passes
- [ ] `npm run test:packages` passes
- [ ] no circular package dependency detected
- [ ] browser/server runtime boundary remains clean
- [ ] compatibility with frozen C.2/C.3/C.4 contracts preserved

## Scope guardrails

- [ ] no major new SDK APIs added
- [ ] no framework-specific wrappers/adapters added
- [ ] no package architecture redesign introduced


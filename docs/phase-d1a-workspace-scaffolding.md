# Phase D.1a Workspace and Package Scaffolding

## Workspace layout

SDK workspace is defined under `packages/`:

- `packages/shared-core`
- `packages/webhook-utils`
- `packages/server-sdk`
- `packages/widget-sdk`

## Dependency diagram

```text
@sammati/shared-core
  ├─> @sammati/webhook-utils
  ├─> @sammati/server-sdk
  └─> @sammati/widget-sdk
```

No package-to-package cross-dependencies are allowed beyond `shared-core` in D.1a.

## Build and test commands

- Root app: `npm run build`
- SDK packages build: `npm run build:packages`
- SDK packages tests: `npm run test:packages`
- D.1a validation: `npm run validate:d1a`

## Tooling

- Workspaces: npm workspaces (`workspaces: ["packages/*"]`)
- Build output: `tsup` with ESM/CJS + d.ts
- Tests: `vitest`
- Type safety: strict TypeScript via shared base config

## Shared-core skeleton implemented

- Common error model (`SammatiError`)
- Error normalization helpers
- Transport abstraction (`Transport`, fetch-based implementation)
- Timeout/abort utilities
- Request options and common list/pagination types
- Widget event envelope base types

## D.1a non-goals enforced

- No server SDK business APIs
- No widget iframe helpers
- No webhook signature verifier implementation
- No backend architecture changes


# Phase D.1e Publishing Readiness Review

**Governance baseline (post–E.1a.1):** Release policy, tag conventions, and approval expectations live in [Phase E.1a.1 release policy](phase-e1a1-release-policy.md) and [governance](phase-e1a1-release-governance.md).

**Local pack + verify tooling (E.1a.2):** Deterministic `npm pack`, tarball inspection, and tarball install smoke are in [E.1a.2 execution guide](phase-e1a2-execution-guide.md) / [runbook](phase-e1a2-local-release-runbook.md) (`npm run release:*`). Older manual steps: [E.1a.1 local dry-run](phase-e1a1-local-dry-run.md).

**Registry publish (E.1a.4):** Gated `npm publish` and post-publish registry smoke — [E.1a.4 publish workflow](phase-e1a4-publish-workflow.md).

This document remains the technical readiness review from D.1e.

## Package metadata

Each package has:

- `name`, `version`, `type: "module"`
- `main`, `module`, `types`
- explicit `exports` map
- `files: ["dist"]`
- `sideEffects: false` for tree-shaking friendliness

## Typings and build artifacts

- `tsup` generates ESM/CJS and declaration files.
- Package-level `typecheck` script validates strict TypeScript.

## Internal export leakage check

- Only top-level API surface is exported from each package.
- No accidental deep/internal subpath exports are exposed.

## Dependency boundary review

- `shared-core` has no internal package dependencies.
- Other SDK packages depend only on `shared-core`.
- No cross-linking between server/webhook/widget packages.

## Browser/server runtime leakage review

- `widget-sdk` uses DOM/browser APIs only.
- `server-sdk` and `webhook-utils` remain framework-agnostic and node-safe.
- No React/Vue/framework adapters included.

## Circular dependency review

- Dependency graph is acyclic:
  - `shared-core -> (none)`
  - `server-sdk -> shared-core`
  - `webhook-utils -> shared-core`
  - `widget-sdk -> shared-core`


# E.1a.4 — Post-publish verification guide

Run after **`npm_publish`** succeeds (or to validate a release another maintainer cut). Complements CI’s **registry smoke** step in [sdk-publish workflow](../.github/workflows/sdk-publish.yml).

---

## 1. npm registry verification

For release version **`X.Y.Z`** (no `v` prefix in `npm view`):

- [ ] `npm view @sammati/shared-core@X.Y.Z version` → `X.Y.Z`
- [ ] `npm view @sammati/webhook-utils@X.Y.Z version` → `X.Y.Z`
- [ ] `npm view @sammati/server-sdk@X.Y.Z version` → `X.Y.Z`
- [ ] `npm view @sammati/widget-sdk@X.Y.Z version` → `X.Y.Z`
- [ ] Optional: open `https://www.npmjs.com/package/@sammati/shared-core` (and siblings); confirm version appears and metadata (description, repository link) looks correct.

---

## 2. Install smoke (clean directory)

Use a **new empty folder** outside the monorepo.

- [ ] `npm init -y`
- [ ] `npm install @sammati/shared-core@X.Y.Z @sammati/webhook-utils@X.Y.Z @sammati/server-sdk@X.Y.Z @sammati/widget-sdk@X.Y.Z --no-fund --no-audit`
- [ ] Confirm install exits **0** and `node_modules/@sammati/*` exists.

---

## 3. ESM / CJS import verification

In the same temp project:

**ESM** (`smoke.mjs` or `"type": "module"`):

- [ ] `import { SammatiError } from '@sammati/shared-core'` resolves.
- [ ] `import { verifyWebhookSignature } from '@sammati/webhook-utils'` resolves.
- [ ] `import { createSammatiClient } from '@sammati/server-sdk'` resolves.
- [ ] `import { buildHostedWidgetUrl } from '@sammati/widget-sdk'` resolves.

**CJS** (`smoke.cjs`):

- [ ] `require('@sammati/shared-core')`, `require('@sammati/webhook-utils')`, `require('@sammati/server-sdk')`, `require('@sammati/widget-sdk')` each load and expose expected exports.

(CI runs equivalent checks in `post-publish-registry-smoke.ts`.)

---

## 4. Dependency resolution verification

In the temp project after install:

- [ ] `npm ls @sammati/shared-core` shows **`X.Y.Z`** (no unexpected duplicate majors).
- [ ] `npm ls @sammati/webhook-utils` / `server-sdk` / `widget-sdk` show **`X.Y.Z`**.
- [ ] `npm explain @sammati/webhook-utils` (npm 9+) optional: confirms dependency on `@sammati/shared-core` within expected range.

---

## 5. Package metadata verification (npm UI / pack)

- [ ] Each package page lists **public** access, correct **version**, and **repository** URL if configured.
- [ ] **Types** available: consuming TypeScript project can `import` without missing-types errors (quick check: `npm pack @sammati/shared-core@X.Y.Z` and inspect tarball contains `dist/*.d.ts` if applicable).

---

## CI cross-check

- [ ] GitHub Actions run for this tag: **`npm_publish`** job **green**.
- [ ] Step **Post-publish install + ESM/CJS smoke (registry)** **green**.

If CI green but manual checks fail, treat as **incident**: registry/CDN delay, regional cache, or environment difference—re-run manual steps after delay; escalate if persistent.

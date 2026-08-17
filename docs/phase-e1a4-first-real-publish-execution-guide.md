# E.1a.4 — First real SDK release: pre-publish execution and validation guide

**Purpose:** Step-by-step operator guide to safely complete a **GitHub Actions dry-run**, activate the **`npm`** environment, execute the **first real publish**, validate results, and handle failures. **Documentation only**—no workflow or SDK changes implied.

**Prerequisites:** [Publish workflow architecture](phase-e1a4-publish-workflow.md), [pre-release readiness](phase-e1a4-pre-release-first-publish-readiness.md), [governance](phase-e1a1-release-governance.md).

---

## 1. GitHub Actions dry-run execution guide

Use this to validate automation **without** registry upload or `NPM_TOKEN`.

**Controlled checklist version:** [Publish pipeline dry-run checklist](phase-e1a4-publish-pipeline-dry-run-checklist.md) (step-by-step validation and safety sign-off).

### 1.1 Start `workflow_dispatch`

1. Open the repository on GitHub → **Actions**.
2. Select workflow **SDK publish** (file: `.github/workflows/sdk-publish.yml`).
3. Click **Run workflow**.
4. **Branch:** leave default (usually `main`); the **tag** you enter determines the commit checked out.
5. **tag:** enter an **existing** annotated tag, e.g. `sdk-v0.1.0`, that points to the release candidate commit.
6. **dry_run_only:** set to **`true`** (this is the default—confirm it is checked/true).
7. Click **Run workflow**.

### 1.2 Validate `verify` job

Open the new workflow run → job **Verify (same gates as SDK verify)**.

- [ ] Job **succeeds** (green).
- [ ] **Checkout** used the ref for your tag (see log).
- [ ] **Install dependencies** (`npm ci`) succeeds.
- [ ] **ci:verify-sdk** succeeds (typecheck, `release:dry-run`, tarball pack/verify, **local-style** tarball install smoke).

If **`verify`** fails: fix locally on the same commit (`npm run ci:verify-sdk`); do not proceed to real publish.

### 1.3 Validate `prepublish` job

Open job **Prepare registry manifests + dry-run publish**.

- [ ] Runs **after** `verify` succeeds.
- [ ] **Verify tag matches package versions** succeeds (tag `sdk-vX.Y.Z` ↔ all four `package.json` `version` = `X.Y.Z`).
- [ ] **Prepare package.json for registry** succeeds (`private` removed in CI workspace; `@sammati/shared-core` → `^X.Y.Z` on dependents).
- [ ] **Reconcile install** (`npm install`) succeeds.
- [ ] **Build SDK packages** succeeds.
- [ ] **Pack tarballs** + **Verify tarball integrity** succeed.

### 1.4 Validate publish dry-run output

In **`prepublish`**, step **npm publish --dry-run (sequential)**:

- [ ] Four dry-runs appear, in order: **shared-core** → **webhook-utils** → **server-sdk** → **widget-sdk**.
- [ ] Each exits **0**; logs show what **would** be published (no upload).

### 1.5 Validate smoke / install verification (dry-run mode)

- [ ] **`npm_publish`** job is **not** run (skipped or omitted)—no **Configure npm authentication**, no real **`npm publish`**, no **Post-publish registry smoke**.
- [ ] **Install/smoke for tarballs** is already covered inside **`ci:verify-sdk`** in **`verify`** (workspace/tarball path—not npm registry).

---

## 2. GitHub environment activation checklist

Complete **before** the first real publish (or before first use of **`npm_publish`**).

### 2.1 Create and name the environment

- [ ] **Settings** → **Environments** → **New environment**.
- [ ] Name: **`npm`** (must match `environment: npm` in the publish workflow).

### 2.2 Add and validate `NPM_TOKEN`

- [ ] In npmjs.com: create a **granular access token** (or automation token) with **Publish** for packages under **`@sammati`** only.
- [ ] In GitHub: Environment **`npm`** → **Environment secrets** → **Add secret** → name **`NPM_TOKEN`**, value = token.
- [ ] Confirm the token works once (optional): from a secure local shell, `npm whoami` with the same token in `~/.npmrc`—then remove local token; do not commit `.npmrc`.

### 2.3 Reviewer configuration

- [ ] Environment **`npm`** → **Required reviewers** → add at least one trusted maintainer (ideally **not** the same person who always triggers publishes).
- [ ] Document who may **approve** deployments to **`npm`**.

### 2.4 Confirm secret isolation before real publish

- [ ] In [`.github/workflows/sdk-publish.yml`](../.github/workflows/sdk-publish.yml), **`secrets.NPM_TOKEN`** appears **only** in the **`npm_publish`** job (e.g. **Configure npm authentication** and **Publish packages**).
- [ ] Run one **`dry_run_only=true`** dispatch (§1): logs for **`verify`** and **`prepublish`** must show **no** npm auth / `.npmrc` token steps.
- [ ] After confirmation, treat **`npm_publish`** approvals as **production** gates.

---

## 3. First real publish execution guide

### 3.1 Version preparation

- [ ] Set the **same** `version` in:
  - `packages/shared-core/package.json`
  - `packages/webhook-utils/package.json`
  - `packages/server-sdk/package.json`
  - `packages/widget-sdk/package.json`
- [ ] Commit and push to the integration branch (e.g. `main`) per your release PR process.
- [ ] Confirm **LICENSE** / `license` field readiness for **public** packages ([metadata](phase-e1a1-package-metadata.md)).

### 3.2 Release tag creation (`sdk-v*`)

On the **exact** commit to release:

```bash
git fetch origin
git checkout <that-commit>
git tag -a sdk-vX.Y.Z -m "SDK X.Y.Z"
```

- [ ] Tag name is **`sdk-v`** + exact **`X.Y.Z`** matching all four `package.json` files.

### 3.3 Local validation on that commit (before push)

```bash
npm ci
```

**PowerShell** (tag check):

```powershell
$env:RELEASE_TAG='sdk-vX.Y.Z'
npm run release:verify-tag
```

**Bash:**

```bash
RELEASE_TAG=sdk-vX.Y.Z npm run release:verify-tag
```

Then:

```bash
npm run ci:verify-sdk
```

- [ ] Both commands **exit 0**.

### 3.4 Push release tag

```bash
git push origin sdk-vX.Y.Z
```

- [ ] Push completes; no force-push to rewrite an already-published tag.

### 3.5 Monitor workflow stages

On **Actions** → **SDK publish** for this run:

1. [ ] **`verify`** — green (§1.2).
2. [ ] **`prepublish`** — green, including dry-run publishes (§1.3–1.4).
3. [ ] **`npm_publish`** — appears; if environment protection is on, **approve** when prompted.
4. [ ] **`npm_publish`** — **Configure npm authentication**, **Publish packages (sequential)** — green.
5. [ ] **Post-publish install + ESM/CJS smoke (registry)** — green.

### 3.6 Validate successful package publish order

In **`npm_publish`** logs, confirm **four** successful **`npm publish`** steps in order:

1. `@sammati/shared-core`
2. `@sammati/webhook-utils`
3. `@sammati/server-sdk`
4. `@sammati/widget-sdk`

---

## 4. Post-publish operator validation

Replace **`X.Y.Z`** with the released version.

### 4.1 `npm view` (registry presence)

```bash
npm view @sammati/shared-core@X.Y.Z version
npm view @sammati/webhook-utils@X.Y.Z version
npm view @sammati/server-sdk@X.Y.Z version
npm view @sammati/widget-sdk@X.Y.Z version
```

- [ ] Each prints **`X.Y.Z`**.

### 4.2 Clean install

In a **new empty directory** (not the monorepo):

```bash
npm init -y
npm install @sammati/shared-core@X.Y.Z @sammati/webhook-utils@X.Y.Z @sammati/server-sdk@X.Y.Z @sammati/widget-sdk@X.Y.Z --no-fund --no-audit
```

- [ ] Install completes with **exit code 0**.

### 4.3 ESM / CJS imports

In that directory, create **`smoke.mjs`**:

```javascript
import { SammatiError } from "@sammati/shared-core";
import { verifyWebhookSignature } from "@sammati/webhook-utils";
import { createSammatiClient } from "@sammati/server-sdk";
import { buildHostedWidgetUrl } from "@sammati/widget-sdk";
console.log(Boolean(SammatiError), Boolean(verifyWebhookSignature), Boolean(createSammatiClient), Boolean(buildHostedWidgetUrl));
```

```bash
node smoke.mjs
```

Create **`smoke.cjs`**:

```javascript
const { SammatiError } = require("@sammati/shared-core");
const { verifyWebhookSignature } = require("@sammati/webhook-utils");
const { createSammatiClient } = require("@sammati/server-sdk");
const { buildHostedWidgetUrl } = require("@sammati/widget-sdk");
console.log(Boolean(SammatiError), Boolean(verifyWebhookSignature), Boolean(createSammatiClient), Boolean(buildHostedWidgetUrl));
```

```bash
node smoke.cjs
```

- [ ] Both print four `true` values (or equivalent) with **no** module errors.

### 4.4 Dependency resolution

```bash
npm ls @sammati/shared-core @sammati/webhook-utils @sammati/server-sdk @sammati/widget-sdk
```

- [ ] All show **`X.Y.Z`** at top level; no unexpected duplicate majors.

### 4.5 Package metadata

- [ ] On npmjs.com, each package page shows **correct version**, **description**, **repository** link, **public** access.
- [ ] Optional: `npm pack @sammati/shared-core@X.Y.Z` and confirm tarball contains **`dist/`** and **`.d.ts`** as expected.

### 4.6 Install smoke (summary)

- [ ] CI **Post-publish registry smoke** step succeeded.
- [ ] Manual §4.2–4.3 completed if you require independence from CI.

---

## 5. Failure handling guide

Use with [release troubleshooting](phase-e1a4-release-troubleshooting.md) and [governance — rollback](phase-e1a1-release-governance.md#rollback-and-deprecation-npm).

| Situation | Operator response |
|-----------|---------------------|
| **Failed `prepublish`** | Do **not** approve **`npm_publish`**. Read logs; fix tag/version mismatch, build, or pack. Re-run dry-run dispatch or fix commit and **new tag** if needed. |
| **Partial publish** | Run `npm view @sammati/<pkg>@X.Y.Z` for each package. Document which versions exist. **Do not** republish same version. **Patch** forward + new tag, or **`npm deprecate`** bad version with replacement message. |
| **Smoke failure after publish** | Confirm packages exist with `npm view`. If replication delay, wait and re-run smoke job or manual §4. If install still fails, treat as **incident**: deprecate if broken; patch release. |
| **Bad metadata** | **`npm deprecate`** affected version; publish **patch** with corrected `package.json` / README (new version + tag). |
| **Token compromise** | Revoke token in npm; rotate **`NPM_TOKEN`** in GitHub env **`npm`**; audit org for unexpected publishes. |
| **Patch recovery** | From tagged release commit (or hotfix branch per policy): bump **patch** version(s), run §3.1–3.3 locally, new tag **`sdk-vX.Y.(Z+1)`**, push tag. |

---

## 6. Freeze readiness checklists

### 6.1 Final operator sign-off

| # | Item | Sign-off (initial / date) |
|---|------|---------------------------|
| 1 | Dry-run dispatch (§1) completed successfully | |
| 2 | GitHub env **`npm`** + **`NPM_TOKEN`** + reviewers (§2) | |
| 3 | Secret isolation confirmed (§2.4) | |
| 4 | First real publish (§3) executed only after §1–3 complete | |
| 5 | Post-publish validation (§4) complete | |
| 6 | Failure handling (§5) understood by on-call maintainer | |

### 6.2 Pre-publish go / no-go

**Go** only if **all** are true:

- [ ] `npm run ci:verify-sdk` passes on the release commit locally.
- [ ] `npm run release:verify-tag` passes for **`sdk-vX.Y.Z`** on that commit.
- [ ] Dry-run **`workflow_dispatch`** with **`dry_run_only=true`** fully green; **`npm_publish`** skipped.
- [ ] **`NPM_TOKEN`** present only on env **`npm`**; reviewers configured if required.
- [ ] Release notes / changelog ready; **LICENSE** acceptable for public npm.

**No-go** if any item fails or if an unreviewed hotfix is mixed into the tagged commit.

### 6.3 Post-publish verification checklist

- [ ] All four `npm view` commands (§4.1) return **`X.Y.Z`**.
- [ ] Clean install (§4.2) succeeds.
- [ ] ESM + CJS smokes (§4.3) succeed.
- [ ] `npm ls` (§4.4) sane.
- [ ] npm UI metadata (§4.5) acceptable.
- [ ] CI **`npm_publish`** + registry smoke green for this tag.

---

## Related documents

- [First publish checklist (one page)](phase-e1a4-first-publish-checklist.md)
- [Operator runbook](phase-e1a4-operator-runbook.md)
- [Post-publish verification (expanded)](phase-e1a4-post-publish-verification.md)
- [Pre-release and first-publish readiness](phase-e1a4-pre-release-first-publish-readiness.md)

# E.1a.4 — Pre-release validation and first-publish readiness

**Purpose:** Operational checklists to complete **before** the first real npm publish and to validate **dry-run** behavior. No workflow or SDK code changes—documentation only.

**Primary execution path:** [First real publish — execution and validation guide](phase-e1a4-first-real-publish-execution-guide.md) (step-by-step dry-run, env activation, publish, post-publish, failure handling, freeze sign-off).

**Related:** [E.1a.4 publish workflow](phase-e1a4-publish-workflow.md), [E.1a.4 operator runbook](phase-e1a4-operator-runbook.md), [First publish checklist](phase-e1a4-first-publish-checklist.md), [Release troubleshooting](phase-e1a4-release-troubleshooting.md), [Post-publish verification](phase-e1a4-post-publish-verification.md), [E.1a.1 governance](phase-e1a1-release-governance.md).

---

## 1. Dry-run workflow validation (`workflow_dispatch`, `dry_run_only=true`)

Complete **once** (or after any workflow change) before trusting automation.

**Expanded walkthrough:** [Publish pipeline dry-run checklist](phase-e1a4-publish-pipeline-dry-run-checklist.md).

### 1.1 Trigger

- [ ] In GitHub: **Actions** → workflow **SDK publish** → **Run workflow**.
- [ ] **tag:** enter an **existing** annotated tag on the default branch history, matching [tag policy](phase-e1a1-release-policy.md#release-tag-naming-git) (e.g. `sdk-v0.1.0`). The commit at that tag must be the release candidate.
- [ ] **dry_run_only:** leave **`true`** (default).

### 1.2 `verify` job (expected behavior)

- [ ] Job runs to completion (green).
- [ ] Steps include **`npm ci`** and **`npm run ci:verify-sdk`** (workspace `file:` deps unchanged).
- [ ] Failure here blocks **`prepublish`** (workflow must not proceed).

### 1.3 `prepublish` job (expected behavior)

- [ ] Job runs after **`verify`** succeeds.
- [ ] **Verify tag matches package versions** runs (`run-verify-release-tag-versions.ts`): tag `sdk-vX.Y.Z` ↔ all four `@sammati/*` `package.json` **`version`** fields = `X.Y.Z`.
- [ ] **Prepare package.json for registry** runs: dependents get `@sammati/shared-core` → `^X.Y.Z`; `private` removed in CI workspace only (ephemeral).
- [ ] **`npm install`** reconciles after manifest rewrite.
- [ ] **`npm run build:packages`** succeeds.
- [ ] **Pack** + **Verify tarball integrity** succeed (same checks as E.1a.2 `cli pack` / `cli verify`).
- [ ] **`npm publish --dry-run`** runs **sequentially** for: `shared-core` → `webhook-utils` → `server-sdk` → `widget-sdk` (four dry-runs, no upload).

### 1.4 `npm_publish` job (must NOT run)

- [ ] With **`dry_run_only=true`**, the **`npm_publish`** job is **skipped** (no `NPM_TOKEN` use, no registry upload).
- [ ] Confirm workflow run shows **`npm_publish`** as **skipped** or absent from required jobs—not failed.

### 1.5 Smoke validation in dry-run mode

- [ ] **No** post-publish registry smoke runs in this mode (smoke is only in **`npm_publish`** after real publish).
- [ ] Tarball/install smoke is already covered inside **`ci:verify-sdk`** in the **`verify`** job (local-style tarball smoke), not registry smoke.

---

## 2. GitHub environment setup checklist (`npm`)

### 2.1 Create environment

- [ ] Repo → **Settings** → **Environments** → **New environment** → name: **`npm`** (exact name matching [workflow `environment: npm`](../.github/workflows/sdk-publish.yml)).

### 2.2 Add `NPM_TOKEN`

- [ ] Generate an npm **granular access token** (or equivalent) with **publish** permission for scope **`@sammati`** only (minimal scope; no broader account access than needed).
- [ ] Add secret **`NPM_TOKEN`** to environment **`npm`** (or org secret restricted to this repo/environment).
- [ ] Confirm **no** `NPM_TOKEN` is defined at repository level **unless** intentionally shared—prefer **environment-only** binding for isolation.

### 2.3 Required reviewers (recommended)

- [ ] Environment **`npm`** → enable **Required reviewers**; assign at least one person who is **not** the sole publisher.
- [ ] Document who may approve **`npm_publish`** runs.

### 2.4 Validate secret isolation

- [ ] Open [`.github/workflows/sdk-publish.yml`](../.github/workflows/sdk-publish.yml) and confirm **`secrets.NPM_TOKEN`** appears **only** under the **`npm_publish`** job (not under **`verify`** or **`prepublish`**).
- [ ] Run a **`dry_run_only=true`** dispatch and confirm logs for **`verify`** / **`prepublish`** contain **no** auth token configuration steps.

---

## 3. First real publish readiness checklist

### 3.1 Version and tag preparation

- [ ] All four packages carry the **same** `version` (`X.Y.Z` or approved prerelease per policy): `shared-core`, `webhook-utils`, `server-sdk`, `widget-sdk`.
- [ ] Changelog / release notes prepared (per [governance](phase-e1a1-release-governance.md)).
- [ ] **LICENSE** and `license` field decision satisfied for **public** npm (see [package metadata](phase-e1a1-package-metadata.md)) before first publish.

### 3.2 Tag naming

- [ ] Annotated tag name: **`sdk-vX.Y.Z`** (must match each `package.json` `version` exactly after stripping `sdk-v` prefix).
- [ ] Tag points to the **exact commit** intended for release (no extra commits after tag without retagging).

### 3.3 Local verification (same commit as tag)

On the machine or CI workspace that matches the tagged commit:

- [ ] `npm ci`
- [ ] `npm run release:verify-tag` with `RELEASE_TAG=sdk-vX.Y.Z` (or rely on `GITHUB_REF` in Actions).
- [ ] `npm run ci:verify-sdk`

### 3.4 npm org and package names

- [ ] Scope **`@sammati`** exists on npm; your account/token can publish all four package names.
- [ ] **No** accidental name collision with existing public packages.

### 3.5 Execute first publish (choose one path)

**Path A — Tag push (recommended)**

- [ ] `git push origin sdk-vX.Y.Z`
- [ ] Watch **SDK publish** workflow: **`verify`** → **`prepublish`** → **`npm_publish`**.
- [ ] Approve **`npm_publish`** if environment protection requires it.

**Path B — Manual dispatch (real publish)**

- [ ] Run workflow with **same tag**, **`dry_run_only=false`**.
- [ ] Approve environment gate if configured.

---

## 4. Post-publish validation checklist

Detailed steps: [Post-publish verification guide](phase-e1a4-post-publish-verification.md).

- [ ] **Registry:** `npm view @sammati/shared-core@X.Y.Z version` (and each package) returns expected version.
- [ ] **CI:** **`npm_publish`** job completed; **Post-publish install + ESM/CJS smoke** step succeeded.
- [ ] **Optional manual:** clean temp dir, `npm init -y`, `npm install @sammati/shared-core@X.Y.Z` … (all four), run minimal import script (ESM + CJS).
- [ ] **`npm ls`** in that temp project shows expected versions and no unexpected hoisting surprises.
- [ ] **Metadata:** npm package pages show `repository`, `README` (if packed), `exports` / types as expected.

---

## 5. Rollback / emergency response checklist

Align with [E.1a.1 governance — rollback](phase-e1a1-release-governance.md#rollback-and-deprecation-npm).

### 5.1 Failed publish (nothing or only dry-run reached)

- [ ] Fix cause (auth, version mismatch, tarball error).
- [ ] Re-run workflow or push corrected tag per policy (do **not** reuse a published version number).

### 5.2 Partial publish (some packages uploaded)

- [ ] Inventory which versions exist on npm (`npm view @sammati/<pkg>@X.Y.Z`).
- [ ] **Do not** republish the same version; publish a **patch** if a fix is required.
- [ ] **`npm deprecate`** bad version with message pointing to fixed version if consumers might install it.

### 5.3 Bad artifact / wrong metadata

- [ ] **Deprecate** affected versions; publish **patch** with corrected metadata/code.
- [ ] Document incident for maintainers.

### 5.4 Token compromise

- [ ] **Revoke** compromised npm token immediately in npm account settings.
- [ ] **Rotate** `NPM_TOKEN` in GitHub environment **`npm`**.
- [ ] Audit npm org access and published packages for unexpected versions.

### 5.5 Patch recovery

- [ ] Branch from the **tagged** release commit (or policy hotfix branch).
- [ ] Bump **patch** version(s); repeat §3 + publish flow.

---

## Freeze sign-off (before first real publish)

| Gate | Owner | Date |
|------|-------|------|
| §1 Dry-run dispatch validated | | |
| §2 Environment + token + isolation | | |
| §3 Tag/version + local verify | | |
| §4 Post-publish plan understood | | |
| §5 Rollback/rotate understood | | |

# E.1a.4 — Publish pipeline dry-run checklist and validation walkthrough

**Purpose:** Validate the **SDK publish** GitHub Actions workflow **end-to-end in dry-run mode** before any real npm publish. **Documentation only**—no workflow edits, no `npm publish`, no SDK changes.

**Workflow:** [`.github/workflows/sdk-publish.yml`](../.github/workflows/sdk-publish.yml)  
**Related:** [First real publish execution guide](phase-e1a4-first-real-publish-execution-guide.md) §1, [Troubleshooting](phase-e1a4-release-troubleshooting.md), [SDK verify (CI)](phase-e1a3-ci-verify.md).

---

## 1. `workflow_dispatch` dry-run walkthrough

Perform on GitHub.com for the repository that hosts this workflow.

### 1.1 Open Actions and select the workflow

- [ ] Navigate: **Actions** tab.
- [ ] In the left workflow list, click **SDK publish** (name from `sdk-publish.yml`; do not confuse with **SDK verify**).

### 1.2 Start a manual run safely

- [ ] Click **Run workflow** (right side).
- [ ] **Use workflow from:** **Branch:** select the default branch that contains the workflow file you intend to validate (usually **`main`**). This only selects *which copy of the workflow definition* runs; the **tag** below selects the **code** to verify.

### 1.3 Set inputs

- [ ] **tag:** enter an **existing** annotated tag on the repo (e.g. `sdk-v0.1.0`) that points to the commit you want to exercise. Must follow [release tag policy](phase-e1a1-release-policy.md#release-tag-naming-git).
- [ ] **dry_run_only:** set to **`true`** (default). **Confirm** it is enabled before starting—this is the primary safety control for a rehearsal.

### 1.4 Start the workflow

- [ ] Click green **Run workflow**.
- [ ] Open the new run from the workflow run list; note the run URL for records.

---

## 2. Verify-stage validation

Open job **Verify (same gates as SDK verify)** (or equivalent name in the run).

### 2.1 Install / setup

- [ ] **Checkout** step: log shows checkout of the commit referenced by your **tag** input (detached HEAD at that commit).
- [ ] **Setup Node.js** step: completes (e.g. Node 22.x + npm cache).
- [ ] **Install dependencies** (`npm ci`): **exit 0**.

### 2.2 Dependency validation

- [ ] **Check workspace dependency policy** (or equivalent): `npm run check:workspace-deps` — **success**.  
  - Failure here usually means unexpected `package.json` dependency lines under `packages/*` (non–`file:../shared-core` or extra deps).

### 2.3 Typecheck

- [ ] **Typecheck SDK packages**: `npm run typecheck:packages` — **success** for all four workspaces.

### 2.4 Package tests

- [ ] **`release:dry-run`’s embedded `test:packages`** runs via `ci:verify-sdk`: all workspace **vitest** steps — **success**.

### 2.5 `release:dry-run` (build, pack, verify)

Inside **`ci:verify-sdk`**, after typecheck:

- [ ] **`npm run build:packages`** — **success** (all four `tsup` builds).
- [ ] **Pack** + **verify** tarballs (E.1a.2 tooling) — **success** (exactly four `.tgz`, integrity rules pass).

### 2.6 Smoke / install validation (workspace path)

- [ ] Step running **`npx tsx scripts/sdk-release/cli.ts smoke --skip-pack`** (or equivalent) — **success**.  
  - This is **tarball install smoke** with workspace-style resolution (overrides), **not** a public-registry install.

If **any** Verify step fails: **stop**—fix locally with `npm run ci:verify-sdk` on the same commit; do not proceed to interpreting Prepublish until Verify is green.

---

## 3. Prepublish-stage validation

Open job **Prepare registry manifests + dry-run publish**.

### 3.1 Release tag / version validation

- [ ] **Verify tag matches package versions** — **success**.  
  - Confirms `sdk-vX.Y.Z` ↔ every `@sammati/*` `package.json` **`version`** = `X.Y.Z`.

### 3.2 Manifest preparation

- [ ] **Prepare package.json for registry** — **success**.  
  - In logs, confirm steps reference rewriting manifests (CI-only): `private` removed; dependents’ `@sammati/shared-core` set to `^X.Y.Z`.

### 3.3 Reconcile and build

- [ ] **`npm install`** after manifest rewrite — **success**.
- [ ] **`npm run build:packages`** — **success**.

### 3.4 Pack and tarball verification

- [ ] **Pack tarballs** — **success** (four `.tgz` written).
- [ ] **Verify tarball integrity** — **success** (exports, typings, forbidden paths, size, metadata match workspace expectations for packed `package.json`).

### 3.5 `npm publish --dry-run`

- [ ] Step **npm publish --dry-run (sequential)** — **success**.
- [ ] Logs show **four** dry-run publishes in **strict order**:
  1. `@sammati/shared-core`
  2. `@sammati/webhook-utils`
  3. `@sammati/server-sdk`
  4. `@sammati/widget-sdk`
- [ ] Each dry-run ends without error; output describes what **would** be published (no upload).

### 3.6 Sequential order confirmation

- [ ] No parallel publish jobs or matrix for publish—**one** sequential script/step pattern in logs.
- [ ] If any package order looks wrong, treat as **incident** against [publish order policy](phase-e1a1-release-policy.md#package-publish-order-npm)—do not approve real publish until resolved.

---

## 4. Safety validation (dry-run only)

Complete **before** treating the run as a successful rehearsal.

### 4.1 No real registry publish

- [ ] **`npm_publish`** job is **skipped** (or not listed as executed)—workflow YAML skips it when `dry_run_only=true`.
- [ ] Logs contain **no** successful real **`npm publish`** (without `--dry-run`) for scoped packages.

### 4.2 No secrets accessed in dry-run path

- [ ] **`verify`** job log: **no** step titled like **Configure npm authentication**, **no** `.npmrc` token write, **no** `NPM_TOKEN` in env dump (GitHub masks secrets—there should be **no such step**).
- [ ] **`prepublish`** job log: same—**no** npm auth configuration steps.

### 4.3 `npm_publish` did not run

- [ ] Workflow summary: **`npm_publish`** shows **Skipped** or is absent from completed jobs (depending on UI).
- [ ] **No** job named like **Publish to npm + registry smoke** in **success** state for this run.

### 4.4 Workflow stayed dry-run only

- [ ] Only **`npm publish --dry-run`** appears under **prepublish**; **no** post-publish **registry** smoke job (that lives under **`npm_publish`** only).

---

## 5. Failure diagnosis checklist

Use when a dry-run run is red. Cross-check [release troubleshooting](phase-e1a4-release-troubleshooting.md).

| Failure area | Operator checks |
|--------------|-----------------|
| **Verify: install** | `package-lock.json` committed; same Node major as workflow; re-run after cache clear if transient. |
| **Verify: `check:workspace-deps`** | Under `packages/*`, consumers must use `"@sammati/shared-core": "file:../shared-core"` only; no stray deps. |
| **Verify: typecheck** | Run `npm run typecheck:packages` locally on **same commit** as tag. |
| **Verify: tests** | Run `npm run test:packages` locally; fix failing vitest. |
| **Verify: `release:dry-run` / pack** | Run `npm run release:dry-run` locally; inspect `.release/packs` and `cli verify` errors. |
| **Verify: tarball / import smoke** | Run `npm run release:dry-run:full` locally; compare Node/npm versions. |
| **Prepublish: tag/version** | `RELEASE_TAG` / `sdk-v*` must match all four `version` fields; run `npm run release:verify-tag` locally with `RELEASE_TAG` set. |
| **Prepublish: manifest prep** | Rare script bug; re-read `prepare-registry-manifests` logs; confirm `shared-core` version read correctly. |
| **Prepublish: `npm publish --dry-run`** | Read npm stderr (scope, package name, `private` field should be gone in CI tree); confirm `--no-git-checks` present in script if git dirty warnings appear. |

---

## 6. Final sign-off checklists

### 6.1 Dry-run success checklist

- [ ] §1 — Workflow started with **`dry_run_only=true`** and correct **tag**.
- [ ] §2 — **Verify** job fully green (install, deps, typecheck, tests, `release:dry-run`, tarball smoke).
- [ ] §3 — **Prepublish** job fully green (tag check, manifests, pack/verify, four **`npm publish --dry-run`** in order).
- [ ] §4 — **Safety** confirmed: no **`npm_publish`**, no token steps in verify/prepublish.

### 6.2 Pre-publish readiness (after dry-run green)

- [ ] GitHub Environment **`npm`** configured with **`NPM_TOKEN`** and reviewers per [execution guide](phase-e1a4-first-real-publish-execution-guide.md) §2.
- [ ] Operators agree on **first real publish** path (tag push vs dispatch with `dry_run_only=false`).
- [ ] Release notes / **LICENSE** readiness for public npm per policy.

### 6.3 Operator sign-off

| Role | Name | Date | Signature / initials |
|------|------|------|----------------------|
| Dry-run executed | | | |
| Safety checks (§4) confirmed | | | |
| Pre-publish readiness (§6.2) confirmed | | | |

---

## Next step

After §6 is complete for a given release candidate, follow [First real publish execution guide](phase-e1a4-first-real-publish-execution-guide.md) §3 for the **first** production publish (still **not** part of this dry-run document).

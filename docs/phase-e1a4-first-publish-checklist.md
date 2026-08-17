# E.1a.4 — First publish checklist (one page)

**Full procedure:** [First real publish — execution and validation guide](phase-e1a4-first-real-publish-execution-guide.md). Use this page as a quick checkbox. Also: [Pre-release readiness](phase-e1a4-pre-release-first-publish-readiness.md), [Operator runbook](phase-e1a4-operator-runbook.md). **Do not publish** until every item is checked.

---

## Preconditions

- [ ] npm org **`@sammati`** and publish token scoped to that scope only.
- [ ] GitHub Environment **`npm`** exists with **`NPM_TOKEN`** and (recommended) required reviewers.
- [ ] Dry-run dispatch completed: [readiness §1](phase-e1a4-pre-release-first-publish-readiness.md#1-dry-run-workflow-validation-workflow_dispatch-dry_run_onlytrue).

---

## Release artifact

- [ ] Same **`version`** in all four `packages/*/package.json`.
- [ ] Annotated tag **`sdk-v`** + same version (e.g. `sdk-v0.1.0` ↔ `0.1.0`).
- [ ] Tag pushed **or** ready to push only after checks below.

---

## Local checks (tagged commit)

- [ ] `npm ci`
- [ ] `RELEASE_TAG=sdk-vX.Y.Z npm run release:verify-tag` (PowerShell: `$env:RELEASE_TAG='sdk-vX.Y.Z'; npm run release:verify-tag`)
- [ ] `npm run ci:verify-sdk`

---

## Publish

- [ ] **Preferred:** `git push origin sdk-vX.Y.Z` → approve **`npm_publish`** if prompted.
- [ ] **Alternative:** workflow_dispatch with **`dry_run_only=false`** and correct **tag**.

---

## After publish

- [ ] [Post-publish verification](phase-e1a4-post-publish-verification.md) complete.
- [ ] Release notes / communication done per governance.

---

## If something goes wrong

- [ ] [Rollback / emergency](phase-e1a4-pre-release-first-publish-readiness.md#5-rollback--emergency-response-checklist) + [troubleshooting](phase-e1a4-release-troubleshooting.md).

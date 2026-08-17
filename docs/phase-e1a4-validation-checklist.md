# Phase E.1a.4 — Validation checklist (freeze)

Complete before declaring **E.1a.4 frozen**.

**Before the first real npm publish**, also complete [Pre-release and first-publish readiness](phase-e1a4-pre-release-first-publish-readiness.md) and the [First publish checklist](phase-e1a4-first-publish-checklist.md).

---

## Workflow safety

- [ ] [`.github/workflows/sdk-publish.yml`](../.github/workflows/sdk-publish.yml) triggers **only** on `sdk-v*` tag push or `workflow_dispatch` (not on ordinary branch pushes).
- [ ] **`verify`** job runs `npm run ci:verify-sdk` with **no** secrets.
- [ ] **`prepublish`** job performs manifest prep, pack/verify, and **`npm publish --dry-run`** with **no** secrets.
- [ ] **`npm_publish`** job is the **only** job referencing **`secrets.NPM_TOKEN`** (and optional environment-only secrets).
- [ ] **`npm_publish`** is skipped for `workflow_dispatch` when **`dry_run_only`** is true (default).

---

## GitHub configuration

- [ ] Environment **`npm`** exists with appropriate protection rules (reviewers) for production.
- [ ] **`NPM_TOKEN`** stored as an environment or repository secret scoped to publish; minimal npm scope (publish for `@sammati` only).
- [ ] npm org **`@sammati`** and package names match [`phase-e1a1-package-metadata.md`](phase-e1a1-package-metadata.md).

---

## Behavior

- [ ] Tag `sdk-v*` matches all four `package.json` **`version`** fields (see `npm run release:verify-tag`).
- [ ] Publish order is **shared-core → webhook-utils → server-sdk → widget-sdk** (no parallel publish).
- [ ] Post-publish **registry** smoke installs all four packages and runs ESM/CJS checks.

---

## Documentation

- [ ] [phase-e1a4-publish-workflow.md](phase-e1a4-publish-workflow.md) is accurate (triggers, jobs, secrets, runbook, troubleshooting).
- [ ] README links E.1a.4 docs.
- [ ] [E.1a.1 release policy](phase-e1a1-release-policy.md) references E.1a.4 where publish automation is described.

---

## Non-goals (confirm)

- [ ] No extra deployment stages added.
- [ ] No SDK feature or API surface changes introduced for this phase.

---

## Sign-off

| Item | Owner | Date |
|------|-------|------|
| Workflow reviewed | | |
| Environment + token configured | | |
| Dry-run + tag publish tested | | |

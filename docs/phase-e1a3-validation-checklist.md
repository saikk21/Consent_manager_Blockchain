# Phase E.1a.3 — Validation checklist (freeze)

Complete before declaring **E.1a.3 frozen**.

---

## Workflow correctness

- [ ] [`.github/workflows/sdk-verify.yml`](../.github/workflows/sdk-verify.yml) exists and triggers on `push` / `pull_request` to `main` and `master`.
- [ ] `workflow_dispatch` enabled for manual re-runs.
- [ ] **No** `npm publish`, **no** `secrets:`, **no** `NPM_TOKEN` in the workflow file.
- [ ] Steps match documented order in [E.1a.3 CI verify](phase-e1a3-ci-verify.md).

---

## Verification depth

- [ ] `npm ci` is the only install step.
- [ ] `check:workspace-deps` gates monorepo `file:` policy for `@sammati/*`.
- [ ] `typecheck:packages` runs before pack/build-heavy steps.
- [ ] `release:dry-run` runs (build + test + pack + tarball verify).
- [ ] Install smoke runs with `--skip-pack` after dry-run (equivalent to `release:dry-run:full` without duplicating dry-run).

---

## Matrix / reproducibility

- [ ] Node **20.x** and **22.x** in matrix; `fail-fast: true`.
- [ ] npm cache configured via `actions/setup-node` + `cache: npm`.
- [ ] `package-lock.json` committed so `npm ci` is reproducible.

---

## Documentation

- [ ] [phase-e1a3-ci-verify.md](phase-e1a3-ci-verify.md) includes flow summary, local vs CI, troubleshooting.
- [ ] README links E.1a.3 docs and `ci:verify-sdk` script.

---

## Clean-clone sanity

- [ ] On a fresh clone: `npm ci && npm run ci:verify-sdk` succeeds locally (Linux or WSL recommended for closest parity with CI).

---

## Non-goals (confirm)

- [ ] No publish workflow or registry credentials.
- [ ] No SDK/API or backend contract changes for this phase.

---

## Sign-off

| Item | Owner | Date |
|------|-------|------|
| Workflow merged | | |
| Required check enabled (optional) | | |

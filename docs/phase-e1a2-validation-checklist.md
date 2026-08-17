# Phase E.1a.2 — Validation checklist (freeze)

Use before declaring **E.1a.2 frozen**.

---

## Tooling and safety

- [ ] `scripts/sdk-release/` implements **pack → verify** with dependency order from `SDK_WORKSPACES`.
- [ ] No script calls `npm publish`, `npm publish --dry-run` against a registry, or writes npm tokens.
- [ ] `.release/` is **gitignored**; default pack output path documented.
- [ ] Tarball inspection uses **local extract** only (temp dirs cleaned up).

---

## npm scripts

- [ ] `npm run release:pack` succeeds from a clean `dist/` (after `build:packages`).
- [ ] `npm run release:verify-packs` succeeds when exactly four `.tgz` files exist in `.release/packs`.
- [ ] `npm run release:dry-run` succeeds (build + test + pack + verify).
- [ ] `npm run release:dry-run:full` succeeds (includes install smoke).
- [ ] `npm run release:smoke-install` succeeds on a maintainer machine (**npm >= 8.3**).

---

## Verification depth

- [ ] **Exports / typings:** verify step requires `exports["."]` keys and `dist/index.js`, `index.cjs`, `index.d.ts`.
- [ ] **Metadata:** packed `package.json` fields match workspace for the audited keys (see runbook).
- [ ] **Secrets / tests:** forbidden path rules reject `.env`-like names and packed `src`/test sources.
- [ ] **Size:** oversized tarball fails fast with clear error.

---

## Install smoke

- [ ] ESM and CJS entry smoke runs against **tarball installs** (not workspace `file:` links alone).
- [ ] Temp install directory is removed on **success and failure**.

---

## Documentation

- [ ] [Local release runbook](phase-e1a2-local-release-runbook.md) matches actual scripts and CLI.
- [ ] README lists E.1a.2 scripts and links to the runbook + this checklist.
- [ ] [E.1a.1](phase-e1a1-validation-checklist.md) remains valid; E.1a.2 references E.1a.1 policy where needed.

---

## Non-goals (confirm)

- [ ] No GitHub Actions workflows added.
- [ ] No npm org publish executed.
- [ ] No SDK API or backend feature changes.

---

## Sign-off

| Item | Owner | Date |
|------|-------|------|
| Scripts verified | | |
| Docs reviewed | | |

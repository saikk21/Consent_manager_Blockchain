# Phase E.1a.1 — Validation checklist (freeze)

Use this checklist before declaring **E.1a.1 frozen**. No CI workflows or npm publish are required for this phase.

---

## E.1a.1 documentation consistency

- [ ] [Release policy](phase-e1a1-release-policy.md) and [governance](phase-e1a1-release-governance.md) do not contradict [D.1e compatibility](phase-d1e-compatibility-versioning.md).
- [ ] Publish order is documented and matches the dependency graph: `shared-core` → `webhook-utils` / `server-sdk` / `widget-sdk`.
- [ ] Tag naming convention is explicit (`sdk-v…`).
- [ ] [Package metadata](phase-e1a1-package-metadata.md) matches actual `package.json` fields (repository, bugs, homepage, descriptions).
- [ ] [Local dry-run](phase-e1a1-local-dry-run.md) commands match root `package.json` scripts (`build:packages`, `test:packages`, `validate:d1a`).
- [ ] README documentation map includes E.1a.1 entries.

---

## Release readiness checklist (pre-publish — manual today)

Run before **any** future coordinated npm release (can be exercised locally now):

- [ ] `npm ci` succeeds at repo root.
- [ ] `npm run validate:d1a` succeeds (or equivalent: app build + `build:packages` + `test:packages`).
- [ ] All intended package versions bumped in **each** released `package.json`.
- [ ] Changelog / release notes prepared (see governance).
- [ ] Git tag name matches [release policy](phase-e1a1-release-policy.md#release-tag-naming-git).
- [ ] `npm pack -w @sammati/…` succeeds for each package in publish order.
- [ ] Tarballs inspected — no stray files, no secrets (see [local dry-run](phase-e1a1-local-dry-run.md#3-tarball-inspection-expectations)).

---

## Package integrity checklist

- [ ] **Exports:** `package.json` `exports["."]` includes `types`, `import`, `require` per package.
- [ ] **Typings:** `dist/index.d.ts` produced after `npm run build` in each package.
- [ ] **ESM/CJS:** `tsup` outputs `dist/index.js` and `dist/index.cjs` as configured.
- [ ] **sideEffects:** `"sideEffects": false` on all four SDK packages.
- [ ] **files:** `"files": ["dist"]` so tarballs stay minimal.
- [ ] **Dependencies:** Workspace packages still use `file:../…` for `@sammati/shared-core` (no accidental drift to registry ranges in E.1a.1).
- [ ] **private:** `private: true` remains until org explicitly prepares first publish.

---

## E.1a.1 non-goals (confirm unchanged)

- [ ] No new GitHub Actions workflows added for publish.
- [ ] No `npm publish` executed.
- [ ] No new SDK APIs or backend features.
- [ ] No change to frozen Phase A/B/C/D platform contracts.

---

## Sign-off

| Item | Owner | Date |
|------|-------|------|
| Docs reviewed | | |
| Metadata aligned | | |
| Local dry-run executed | | |

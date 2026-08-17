# Phase E.1a.2 — Local release runbook (dry-run kit)

**Scope:** Deterministic **local** pack, tarball verification, and optional install smoke. **No `npm publish`**, no GitHub Actions, no registry writes except `npm install` in a **temporary** directory during smoke tests.

**Governance:** [E.1a.1 release policy](phase-e1a1-release-policy.md), [governance](phase-e1a1-release-governance.md).

---

## Prerequisites

- Repository root: run all npm scripts from the monorepo root.
- **tar** available on `PATH` (Windows 10+ ships `tar`; used to inspect `.tgz` files).
- **npm >= 8.3** for install smoke (`overrides` to pin `@sammati/shared-core` tarballs for nested `file:` deps).

---

## Standard commands (npm scripts)

| Script | What it does |
|--------|----------------|
| `npm run release:pack` | `build:packages`, then `npm pack` each workspace in **dependency order** into `.release/packs/`. |
| `npm run release:verify-packs` | Validates every `.tgz` in `.release/packs/` (structure, exports, typings, size, no forbidden paths). Expects **exactly four** tarballs. |
| `npm run release:smoke-install` | `build:packages`, then pack + verify + **clean temp dir** `npm install` + ESM/CJS import smoke. |
| `npm run release:dry-run` | `build:packages` + `test:packages` + pack + verify (no install smoke). |
| `npm run release:dry-run:full` | Same as `release:dry-run`, then install smoke using **already packed** tarballs (`--skip-pack`). |

**Registry safety:** None of these scripts invoke `npm publish`. Smoke uses only `file:` tarballs on disk.

---

## CLI (advanced)

From repo root:

```text
npx tsx scripts/sdk-release/cli.ts pack [--out <dir>]
npx tsx scripts/sdk-release/cli.ts verify [--out <dir>]
npx tsx scripts/sdk-release/cli.ts smoke [--out <dir>] [--skip-pack]
```

Default `--out` is `.release/packs` (see `scripts/sdk-release/config.ts`).

---

## Pack order (enforced)

The tooling always packs in this order:

1. `@sammati/shared-core`
2. `@sammati/webhook-utils`
3. `@sammati/server-sdk`
4. `@sammati/widget-sdk`

Implemented in `scripts/sdk-release/pack-workspaces.ts` and `config.ts` (`SDK_WORKSPACES`).

---

## Tarball verification (what `verify` checks)

For each tarball:

- **Layout:** Extracts with `tar`; expects `package/package.json` and `package/dist/**`.
- **Size:** Tarball size ≤ `MAX_TARBALL_BYTES` in `config.ts` (currently 600 KB).
- **Forbidden paths:** Path fragments such as `.env`, `.pem`, `id_rsa`, `webhook-receiver-log`; rejects `src/` or `*.test.ts` / `*.spec.ts` inside the pack.
- **package.json:** `name`, `version`, `type`, `sideEffects`, `main`, `module`, `types`, `exports`, `files` match the workspace `package.json` exactly (including key order as serialized on disk — keep workspace manifests stable).
- **exports:** `exports["."]` must define `types`, `import`, `require`.
- **dist:** Requires `index.js`, `index.cjs`, `index.d.ts` under `dist/` (additional artifacts such as `index.d.cts` are allowed).

---

## Install smoke flow

1. Pack all four workspaces (or reuse `--skip-pack`).
2. Create a **temporary** directory under the OS temp folder.
3. Write a `package.json` with:
   - `dependencies`: each package as `file:<absolute-path-to-.tgz>`
   - `overrides`: `@sammati/shared-core` → same `file:` tarball so nested `file:../shared-core` inside packed dependents resolves correctly.
4. Run `npm install --no-fund --no-audit`.
5. Run `node ./smoke-esm.mjs` and `node ./smoke.cjs` importing public APIs from all four packages.
6. **Always** delete the temp directory (`finally`).

---

## Outputs

- Packed files default to **`.release/packs/*.tgz`** (gitignored).
- Reproducibility: run `npm run build:packages` before pack so `dist/` matches CI expectations.

---

## Related

- [E.1a.2 validation checklist](phase-e1a2-validation-checklist.md)
- [E.1a.3 CI verify](phase-e1a3-ci-verify.md) — same gates on GitHub Actions (`sdk-verify` workflow)
- [E.1a.1 local dry-run (manual)](phase-e1a1-local-dry-run.md) — historical manual steps; prefer this runbook for E.1a.2+

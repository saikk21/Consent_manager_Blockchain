# Phase E.1a.1 — Local release dry-run (no publish)

**Update (E.1a.2):** Prefer the scripted workflow in [Phase E.1a.2 local release runbook](phase-e1a2-local-release-runbook.md) (`npm run release:*`). This page remains as a **manual** reference.

Use this flow to validate **build outputs and pack contents** before any CI publish automation (E.1a.3+) or registry upload. Commands assume **Windows PowerShell** or any shell with `npm` on `PATH`; run from the **repository root**.

---

## 1. Clean validation flow

```powershell
cd "path\to\Project Sammati"
npm ci
npm run validate:d1a
```

`validate:d1a` runs app `tsc` build, `build:packages`, and all workspace tests. For SDK-only checks without the main app build, use:

```powershell
npm run build:packages
npm run test:packages
```

Optional per-package strict typing:

```powershell
npm run typecheck --workspace @sammati/shared-core
npm run typecheck --workspace @sammati/webhook-utils
npm run typecheck --workspace @sammati/server-sdk
npm run typecheck --workspace @sammati/widget-sdk
```

---

## 2. Pack each package (`npm pack`)

From repo root, pack in **publish order**. By default, `.tgz` files are written to the **current directory**; use `--pack-destination` to avoid clutter:

```powershell
$dst = Join-Path $env:TEMP "sammati-pack"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
npm pack -w @sammati/shared-core --pack-destination $dst
npm pack -w @sammati/webhook-utils --pack-destination $dst
npm pack -w @sammati/server-sdk --pack-destination $dst
npm pack -w @sammati/widget-sdk --pack-destination $dst
```

Expect **four** `.tgz` files named like `sammati-shared-core-0.1.0.tgz` (npm flattens the scope in the filename).

---

## 3. Tarball inspection expectations

For each `.tgz`:

1. **Contents:** Only intended files — notably `package/package.json` and `package/dist/**`. With current `files: ["dist"]`, **no `src/`** should appear.
2. **`package.json` inside tarball:** `name`, `version`, `exports`, `main`/`module`/`types` match the workspace package.
3. **No secrets:** No `.env`, keys, or local paths leaked into `files`.
4. **Declarations:** `dist/index.d.ts` present if the build succeeded.

**Quick listing (PowerShell):** expand or use `tar -tf .\sammati-shared-core-0.1.0.tgz` (Node/npm pack uses tar).

---

## 4. Optional install smoke (local tarball)

In a **temporary directory outside the repo**:

```powershell
mkdir $env:TEMP\sammati-pack-smoke
cd $env:TEMP\sammati-pack-smoke
npm init -y
npm install "path\to\Project Sammati\sammati-shared-core-0.1.0.tgz"
```

For packages that depend on `shared-core`, install **shared-core tarball first**, then the dependent tarball, or use `npm install ./a.tgz ./b.tgz` in dependency order. (After registry publish, npm resolves semver automatically; **local tarballs** require order or a Verdaccio-style registry in a later phase.)

---

## Non-goals (E.1a.1)

- GitHub Actions
- `npm publish` or `npm publish --dry-run` against the public registry (optional in E.1a.2/3; not required to freeze E.1a.1 docs)

---

## Related

- [Validation checklist](phase-e1a1-validation-checklist.md)
- [Release policy — publish order](phase-e1a1-release-policy.md#package-publish-order-npm)

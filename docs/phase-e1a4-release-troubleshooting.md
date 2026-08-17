# E.1a.4 — Release operator troubleshooting

Symptoms during **SDK publish** or immediately after. For architecture, see [publish workflow](phase-e1a4-publish-workflow.md). For checklists, see [pre-release readiness](phase-e1a4-pre-release-first-publish-readiness.md).

---

## Workflow does not start

| Symptom | Checks |
|---------|--------|
| No run on push | Confirm you pushed a **tag** matching `sdk-v*` (not only a branch commit). |
| Dispatch missing | Actions tab → **SDK publish** enabled for this repo; default branch may affect visibility of manual runs. |

---

## `verify` job fails

| Symptom | Checks |
|---------|--------|
| `npm ci` fails | `package-lock.json` committed and in sync; run `npm ci` locally on same commit. |
| `ci:verify-sdk` fails | Run `npm run ci:verify-sdk` locally; fix typecheck/tests/pack/smoke (E.1a.2–E.1a.3). |
| Wrong commit | Checkout ref for dispatch must be the **tag** you intend to ship (`tag` input). |

---

## `prepublish` fails

| Symptom | Checks |
|---------|--------|
| Tag / version mismatch | Tag must be `sdk-vX.Y.Z` and all four `package.json` **`version`** = `X.Y.Z`. Run `npm run release:verify-tag` locally with `RELEASE_TAG` set. |
| Pack / verify fails | Same as local `npm run release:dry-run`; inspect `dist/` and tarball rules. |
| `npm publish --dry-run` fails | Scoped package or npm CLI message; confirm npm version on runner; some setups need read-only token for dry-run (document if you add one—default workflow has **no** token here). |

---

## `npm_publish` skipped when you expected publish

| Symptom | Checks |
|---------|--------|
| Manual run | **`dry_run_only`** must be **`false`** for real publish. Default is **`true`**. |
| Tag push | **`npm_publish`** should run on `sdk-v*` push; confirm workflow file unchanged and branch/tag event in logs. |

---

## `npm_publish` fails (auth or upload)

| Symptom | Checks |
|---------|--------|
| 401 / 403 | **`NPM_TOKEN`** in environment **`npm`**; token has **publish** for `@sammati`; 2FA not blocking automation token. |
| E403 wrong package | Package name or scope not owned by org; token not authorized for that package. |
| Version already exists | Bump **patch** (or new version) and **new tag**; cannot overwrite existing npm version. |

---

## Post-publish smoke fails

| Symptom | Checks |
|---------|--------|
| Timeout on `npm view` | npm replication delay; re-run job or wait and verify manually (see [post-publish guide](phase-e1a4-post-publish-verification.md)). |
| Install resolves wrong version | Confirm all four packages published same version; `dependencies` use `^` on shared-core as prepared in CI. |

---

## Partial publish

- See [readiness §5.2](phase-e1a4-pre-release-first-publish-readiness.md#52-partial-publish-some-packages-uploaded): inventory `npm view`, **patch forward**, **`npm deprecate`** if needed.

---

## Secret leakage concern

- If token appears in logs, **revoke** token, **rotate** `NPM_TOKEN`, follow [readiness §5.4](phase-e1a4-pre-release-first-publish-readiness.md#54-token-compromise).

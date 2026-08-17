# Phase E.1a.1 — Release policy and versioning contract

This document freezes **release semantics** for `@sammati/*` SDK packages in this monorepo. It does **not** turn on CI publish jobs or npm publishes (see [Phase E.1a.1 governance](phase-e1a1-release-governance.md)).

**Related:** [Compatibility and SemVer (D.1e)](phase-d1e-compatibility-versioning.md), [Publishing readiness (D.1e)](phase-d1e-publishing-readiness.md), [Package metadata (E.1a.1)](phase-e1a1-package-metadata.md).

---

## Scope

- `@sammati/shared-core`
- `@sammati/webhook-utils`
- `@sammati/server-sdk`
- `@sammati/widget-sdk`

The **application** package `sammati-ledger` (repo root) remains **private** and is **not** published to npm under this policy unless explicitly decided later.

---

## Semantic versioning (SemVer)

Per [Phase D.1e compatibility](phase-d1e-compatibility-versioning.md):

| Bump | Meaning |
|------|---------|
| **Major** | Breaking SDK public API, or breaking behavioral contract documented as stable (including frozen C.2/C.3/C.4 expectations consumers rely on). |
| **Minor** | Additive APIs, options, or types; backward compatible for existing callers. |
| **Patch** | Bugfixes and internal hardening; no intentional contract changes. |

**Additive platform fields** (backend responses) remain non-breaking for SDK majors as in D.1e.

---

## Version coordination between packages

1. **Baseline rule:** Each package has its own `version` in `package.json`. Versions **often move together** for a single “SDK release” so consumers install a known-good combination.
2. **Lockstep recommendation:** For a coordinated SDK release, bump **all published packages** that ship in that release to the **same `x.y.z`** (or document exceptions in the release notes). This reduces “mixed minor” confusion.
3. **Independent patches:** A **patch** may ship for one package only if the fix is localized and dependency ranges still resolve (e.g. patch to `widget-sdk` only). The release notes must state which packages changed.
4. **Pre-releases:** Use `x.y.z-rc.n` or `x.y.z-beta.n` on npm when early adopters need registry installs. Promotion to stable `x.y.z` is a version bump + publish; no code change required if validation-only.

**Workspace note:** Local development and CI **verify** jobs use `file:../…` workspace links. **Registry publishes** rewrite dependents to `^<shared-core version>` in CI immediately before `npm publish` — see [E.1a.4 publish workflow](phase-e1a4-publish-workflow.md) (`prepare-registry-manifests`).

**Local pack validation (E.1a.2):** See [E.1a.2 runbook](phase-e1a2-local-release-runbook.md) for deterministic `npm pack`, tarball inspection, and tarball install smoke (**no registry publish**).

**Automated publish (E.1a.4):** See [E.1a.4 publish workflow](phase-e1a4-publish-workflow.md) and [validation checklist](phase-e1a4-validation-checklist.md).

---

## Release tag naming (Git)

- **Coordinated SDK release:** Annotated tag `sdk-v<MAJOR>.<MINOR>.<PATCH>` (example: `sdk-v0.2.0`) on the commit that **exactly matches** the versions in the published `package.json` files for that release.
- **Hotfix:** Optional tag `sdk-v<version>-hotfix.<n>` or reuse `sdk-v<version>` only if policy allows; prefer **new patch version** and one clear tag per publish batch.
- Tags are **immutable pointers** to source; npm versions are immutable once published.

---

## Package publish order (npm)

When publishing via [E.1a.4](phase-e1a4-publish-workflow.md), order must respect the dependency DAG:

1. `@sammati/shared-core`
2. `@sammati/webhook-utils`
3. `@sammati/server-sdk`
4. `@sammati/widget-sdk`

Never publish a consumer before its dependency versions are live on the registry.

---

## Compatibility matrix (consumer expectations)

| Concern | Source of truth |
|--------|------------------|
| SemVer rules | This doc + [D.1e compatibility](phase-d1e-compatibility-versioning.md) |
| HTTP API paths | Frozen `/v1/…` platform; see phase API docs |
| Webhook signature | [C.3 signature spec](phase-c3-signature-spec.md) |
| postMessage | [C.4 postMessage spec](phase-c4-postmessage-spec.md), `version: "1.0"` |
| Runtime (Node / browser) | [D.1e compatibility](phase-d1e-compatibility-versioning.md) |

Breaking changes to webhook or postMessage contracts require a **major** SDK bump and explicit **migration notes** (see governance doc).

---

## Non-goals (E.1a.1)

- GitHub Actions workflows, OIDC, or automated `npm publish`
- Changing backend architecture or SDK feature surface
- Replacing `file:` workspace links (deferred to pre-publish milestone)

---

## Freeze criteria (E.1a.1)

- This policy and [governance](phase-e1a1-release-governance.md) are reviewed and consistent with D.1e.
- [Validation checklist](phase-e1a1-validation-checklist.md) passes for documentation and metadata alignment.

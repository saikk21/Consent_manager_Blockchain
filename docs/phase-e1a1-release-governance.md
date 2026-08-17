# Phase E.1a.1 — Release governance

Companion to [Release policy and versioning](phase-e1a1-release-policy.md). Defines **who**, **how**, and **what happens when things go wrong**, without implementing CI/CD or npm publish automation.

---

## Roles and permissions

| Role | Responsibility |
|------|----------------|
| **Release owner** | Proposes version bumps, assembles release notes, ensures local dry-run checklist passes ([local dry-run](phase-e1a1-local-dry-run.md)). |
| **Release approver** | Confirms versions, changelog accuracy, and compatibility claims; approves merge/tag for a coordinated release. |
| **Org/npm admins** | Hold npm org permissions for `@sammati`; rotate tokens; run or gate future automated publish workflows. |

**Default expectation:** At least **one reviewer** who did not author the version bumps approves the release PR. For the **first** public npm publish, use **two maintainers** (author + approver) where practical.

---

## Release approval expectations

Before a release PR merges (or before a publish tag is applied in future automation):

1. [E.1a.1 validation checklist](phase-e1a1-validation-checklist.md) — documentation consistency.
2. [Release readiness checklist](phase-e1a1-validation-checklist.md#release-readiness-checklist-pre-publish) — build, test, pack sanity (local or CI verify job when available).
3. Version numbers and **tag name** match [release policy](phase-e1a1-release-policy.md#release-tag-naming-git).
4. **Migration notes** present if **major** or contract-changing **minor** (webhook/postMessage).

---

## Rollback and deprecation (npm)

- **Republish same version:** Not allowed on npm. **Recovery = new patch version.**
- **Bad tarball / broken install:** Publish patch fix; **`npm deprecate`** the bad version with a short reason and replacement version (see npm docs).
- **Security or policy-critical artifact:** Follow org incident process; **`npm unpublish`** only under npm policy windows and org rules; document in post-incident notes.

---

## Patch recovery flow

1. Branch from the **tagged** release commit (or `main` at that tag).
2. Implement fix; bump **patch** on affected package(s).
3. Re-run [local dry-run](phase-e1a1-local-dry-run.md) and release readiness checks.
4. New tag per [release policy](phase-e1a1-release-policy.md); publish order unchanged.

---

## Dependency audit expectations

- Before a coordinated release, run **`npm audit`** at the repo root; record **high/critical** findings in the release PR or notes.
- **Policy (baseline):** Do not ship a release that knowingly introduces unresolved **critical** vulnerabilities in published SDK dependency chains; escalate or patch.
- **Lockfile:** Root `package-lock.json` is authoritative for workspace installs; release owner verifies install is reproducible (`npm ci`).

---

## Secrets and publish tokens (E.1a.4)

- **No tokens in git.** The gated publish workflow uses **`NPM_TOKEN`** only in the protected **`npm_publish`** job and GitHub **Environment** `npm` — see [E.1a.4 publish workflow](phase-e1a4-publish-workflow.md).
- **Least privilege:** Use a granular npm token with **publish** for **`@sammati`** only; rotate on maintainer offboarding.
- **Provenance:** OIDC / npm provenance is optional follow-up (not required for E.1a.4 baseline).

---

## Non-goals (E.1a.1)

- Step-by-step GitHub Environment **setup** (reviewers, secret binding) — see [E.1a.4](phase-e1a4-publish-workflow.md).
- Incident response for production Sammati **servers** (out of SDK scope).

---

## Freeze criteria (E.1a.1)

- Governance expectations are explicit; no contradiction with [release policy](phase-e1a1-release-policy.md).
- [Validation checklist](phase-e1a1-validation-checklist.md) signed off for E.1a.1.

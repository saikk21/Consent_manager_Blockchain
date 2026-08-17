# E.1a.4 — Operator runbook (npm publish)

**Audience:** Maintainers running or approving **SDK publish** workflows.

**Do not use this to change workflow YAML**—only to operate releases.

**Authoritative first-release steps:** [First real publish — execution and validation guide](phase-e1a4-first-real-publish-execution-guide.md). Supporting checklists: [Pre-release readiness](phase-e1a4-pre-release-first-publish-readiness.md).

---

## Responsibilities

| Role | Actions |
|------|---------|
| **Release owner** | Version bumps, tag, local `ci:verify-sdk`, open/trigger workflow, watch logs. |
| **Environment approver** | Approves **`npm_publish`** when GitHub Environment **`npm`** requires it. |
| **npm org admin** | Tokens, scope **`@sammati`**, 2FA, deprecations. |

---

## Standard flows

### A. Safe rehearsal (no registry write)

1. Ensure an annotated **`sdk-v*`** tag exists on the intended commit.
2. **Actions** → **SDK publish** → **Run workflow** → set **tag** → **`dry_run_only: true`** (default).
3. Confirm **`verify`** and **`prepublish`** green; **`npm_publish`** **skipped**.

### B. Production publish via tag (preferred)

1. Complete [first-publish checklist](phase-e1a4-first-publish-checklist.md) / [readiness §3](phase-e1a4-pre-release-first-publish-readiness.md#3-first-real-publish-readiness-checklist).
2. `git push origin sdk-vX.Y.Z`
3. Monitor workflow; approve **`npm_publish`** if required.
4. Run [post-publish verification](phase-e1a4-post-publish-verification.md).

### C. Production publish via dispatch (exceptional)

1. Same readiness as (B).
2. **Run workflow** with **tag** + **`dry_run_only: false`**.
3. Approve **`npm_publish`**.

---

## What each job does (operator view)

| Job | Secrets | Outcome |
|-----|---------|---------|
| **verify** | None | Confirms `ci:verify-sdk` on **unmodified** workspace (`file:` deps). |
| **prepublish** | None | Rewrites manifests for registry, packs, verifies, **`npm publish --dry-run`** only. |
| **npm_publish** | **`NPM_TOKEN`** | Real publish + **registry** install smoke. |

---

## References

- Workflow architecture: [phase-e1a4-publish-workflow.md](phase-e1a4-publish-workflow.md)
- Troubleshooting: [phase-e1a4-release-troubleshooting.md](phase-e1a4-release-troubleshooting.md)
- Policy: [phase-e1a1-release-policy.md](phase-e1a1-release-policy.md)

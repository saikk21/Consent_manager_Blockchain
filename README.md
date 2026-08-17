# Sammati Ledger

Consent metadata ledger with async Merkle proofs and mock anchoring. **Phase A** (core writes + reads) and **Phase B** (proof workers + proof APIs) are implemented and frozen for this repo.

## Quickstart

Copy-paste local setup:

- [`docs/quickstart.md`](docs/quickstart.md)

## Documentation map

| Document | Purpose |
|----------|---------|
| [`docs/architecture-overview.md`](docs/architecture-overview.md) | Phase A + Phase B architecture writeup |
| [`docs/architecture-diagrams.md`](docs/architecture-diagrams.md) | Mermaid diagrams (components, sequences, state machines) |
| [`docs/quickstart.md`](docs/quickstart.md) | Local run: DB, migrate, bootstrap, curl |
| [`docs/phase-a-api-contracts.md`](docs/phase-a-api-contracts.md) | Phase A HTTP contracts (consent lifecycle + reads) |
| [`docs/phase-b-api-contracts.md`](docs/phase-b-api-contracts.md) | Phase B HTTP contracts (proofs + verify) |
| [`docs/phase-a-validation-checklist.md`](docs/phase-a-validation-checklist.md) | Phase A validation + safe DB count query |
| [`docs/phase-b-runtime-validation.md`](docs/phase-b-runtime-validation.md) | Phase B freeze validation summary |
| [`docs/phase-c1-policy-artifacts.md`](docs/phase-c1-policy-artifacts.md) | Phase C.1 policy artifacts (schema + API) |
| [`docs/phase-c2-widget-session-contracts.md`](docs/phase-c2-widget-session-contracts.md) | Phase C.2 widget session backend contracts |
| [`docs/phase-c2-validation-checklist.md`](docs/phase-c2-validation-checklist.md) | Phase C.2 runtime validation checklist |
| [`docs/phase-c3-webhooks-api-contracts.md`](docs/phase-c3-webhooks-api-contracts.md) | Phase C.3 webhook endpoint API contracts |
| [`docs/phase-c3-signature-spec.md`](docs/phase-c3-signature-spec.md) | Phase C.3 webhook signature verification spec |
| [`docs/phase-c3-retry-semantics.md`](docs/phase-c3-retry-semantics.md) | Phase C.3 delivery retries and dead-letter semantics |
| [`docs/phase-c3-delivery-lifecycle-diagram.md`](docs/phase-c3-delivery-lifecycle-diagram.md) | Phase C.3 delivery lifecycle state diagram |
| [`docs/phase-c3-validation-checklist.md`](docs/phase-c3-validation-checklist.md) | Phase C.3 runtime validation checklist |
| [`docs/phase-c4-runtime-contracts.md`](docs/phase-c4-runtime-contracts.md) | Phase C.4 hosted widget runtime contracts |
| [`docs/phase-c4-iframe-integration-guide.md`](docs/phase-c4-iframe-integration-guide.md) | Phase C.4 iframe embed integration guide |
| [`docs/phase-c4-postmessage-spec.md`](docs/phase-c4-postmessage-spec.md) | Phase C.4 postMessage runtime schema |
| [`docs/phase-c4-embed-security-model.md`](docs/phase-c4-embed-security-model.md) | Phase C.4 embed security model |
| [`docs/phase-c4-runtime-validation-checklist.md`](docs/phase-c4-runtime-validation-checklist.md) | Phase C.4 runtime validation checklist |
| [`docs/phase-d1a-workspace-scaffolding.md`](docs/phase-d1a-workspace-scaffolding.md) | Phase D.1a SDK workspace and package scaffolding |
| [`docs/phase-d1a-validation-checklist.md`](docs/phase-d1a-validation-checklist.md) | Phase D.1a build/test validation checklist |
| [`docs/phase-d1b-webhook-utils.md`](docs/phase-d1b-webhook-utils.md) | Phase D.1b webhook verification utility package |
| [`docs/phase-d1b-validation-checklist.md`](docs/phase-d1b-validation-checklist.md) | Phase D.1b validation checklist |
| [`docs/phase-d1c-server-sdk.md`](docs/phase-d1c-server-sdk.md) | Phase D.1c minimal typed server SDK |
| [`docs/phase-d1c-validation-checklist.md`](docs/phase-d1c-validation-checklist.md) | Phase D.1c validation checklist |
| [`docs/phase-d1d-widget-sdk.md`](docs/phase-d1d-widget-sdk.md) | Phase D.1d minimal widget/browser SDK helpers |
| [`docs/phase-d1d-validation-checklist.md`](docs/phase-d1d-validation-checklist.md) | Phase D.1d validation checklist |
| [`docs/phase-d1e-sdk-consolidation.md`](docs/phase-d1e-sdk-consolidation.md) | Phase D.1e SDK integration quickstart and consolidation |
| [`docs/phase-d1e-compatibility-versioning.md`](docs/phase-d1e-compatibility-versioning.md) | Phase D.1e compatibility and versioning guarantees |
| [`docs/phase-d1e-publishing-readiness.md`](docs/phase-d1e-publishing-readiness.md) | Phase D.1e package publishing readiness notes |
| [`docs/phase-d1e-validation-checklist.md`](docs/phase-d1e-validation-checklist.md) | Phase D.1e consolidation freeze checklist |
| [`docs/phase-e1a1-release-policy.md`](docs/phase-e1a1-release-policy.md) | Phase E.1a.1 SDK release policy and versioning contract |
| [`docs/phase-e1a1-release-governance.md`](docs/phase-e1a1-release-governance.md) | Phase E.1a.1 release governance (roles, rollback, audits) |
| [`docs/phase-e1a1-package-metadata.md`](docs/phase-e1a1-package-metadata.md) | Phase E.1a.1 package metadata and npm scope conventions |
| [`docs/phase-e1a1-local-dry-run.md`](docs/phase-e1a1-local-dry-run.md) | Phase E.1a.1 local pack and tarball verification (no publish) |
| [`docs/phase-e1a1-validation-checklist.md`](docs/phase-e1a1-validation-checklist.md) | Phase E.1a.1 validation and release-readiness checklists |
| [`docs/phase-e1a2-execution-guide.md`](docs/phase-e1a2-execution-guide.md) | Phase E.1a.2 local release dry-run execution guide |
| [`docs/phase-e1a2-local-release-runbook.md`](docs/phase-e1a2-local-release-runbook.md) | Phase E.1a.2 pack, verify, and install-smoke runbook |
| [`docs/phase-e1a2-validation-checklist.md`](docs/phase-e1a2-validation-checklist.md) | Phase E.1a.2 validation checklist |
| [`docs/phase-e1a3-ci-verify.md`](docs/phase-e1a3-ci-verify.md) | Phase E.1a.3 GitHub Actions verify-only CI |
| [`docs/phase-e1a3-validation-checklist.md`](docs/phase-e1a3-validation-checklist.md) | Phase E.1a.3 CI validation checklist |
| [`docs/phase-e1a4-publish-workflow.md`](docs/phase-e1a4-publish-workflow.md) | Phase E.1a.4 gated npm publish workflow (GitHub Actions) |
| [`docs/phase-e1a4-validation-checklist.md`](docs/phase-e1a4-validation-checklist.md) | Phase E.1a.4 publish workflow validation checklist |
| [`docs/phase-e1a4-pre-release-first-publish-readiness.md`](docs/phase-e1a4-pre-release-first-publish-readiness.md) | E.1a.4 pre-release validation and first-publish readiness |
| [`docs/phase-e1a4-operator-runbook.md`](docs/phase-e1a4-operator-runbook.md) | E.1a.4 release operator runbook |
| [`docs/phase-e1a4-first-publish-checklist.md`](docs/phase-e1a4-first-publish-checklist.md) | E.1a.4 one-page first publish checklist |
| [`docs/phase-e1a4-release-troubleshooting.md`](docs/phase-e1a4-release-troubleshooting.md) | E.1a.4 release troubleshooting for operators |
| [`docs/phase-e1a4-post-publish-verification.md`](docs/phase-e1a4-post-publish-verification.md) | E.1a.4 post-publish verification guide |
| [`docs/phase-e1a4-first-real-publish-execution-guide.md`](docs/phase-e1a4-first-real-publish-execution-guide.md) | E.1a.4 first real SDK release — operator execution and validation |
| [`docs/phase-e1a4-publish-pipeline-dry-run-checklist.md`](docs/phase-e1a4-publish-pipeline-dry-run-checklist.md) | E.1a.4 publish pipeline dry-run checklist and walkthrough |

## SDK releases and versioning (Phase E.1a.1)

Governance for `@sammati/*` packages is **document-only** in this phase: no automated npm publish yet.

- **Policy:** [Release policy and SemVer coordination](docs/phase-e1a1-release-policy.md)
- **Governance:** [Roles, approval, deprecation, audits](docs/phase-e1a1-release-governance.md)
- **Metadata:** [Package names, visibility, version alignment](docs/phase-e1a1-package-metadata.md)
- **Local dry-run:** [Build, test, `npm pack`, tarball expectations](docs/phase-e1a1-local-dry-run.md)
- **Freeze checklist:** [E.1a.1 validation](docs/phase-e1a1-validation-checklist.md)

Compatibility guarantees remain in [Phase D.1e compatibility](docs/phase-d1e-compatibility-versioning.md). Publishing-readiness technical notes stay in [D.1e publishing readiness](docs/phase-d1e-publishing-readiness.md).

### Local SDK release dry-run (Phase E.1a.2)

No registry publish—only pack, verify, and optional tarball install smoke.

| Script | Purpose |
|--------|---------|
| `npm run release:pack` | Build SDK packages and `npm pack` each into `.release/packs/`. |
| `npm run release:verify-packs` | Inspect all tarballs in `.release/packs/`. |
| `npm run release:smoke-install` | Pack, verify, temp `npm install`, ESM/CJS import smoke. |
| `npm run release:dry-run` | `build:packages` + `test:packages` + pack + verify. |
| `npm run release:dry-run:full` | `release:dry-run` + smoke (reuses packs). |

Guide: [Phase E.1a.2 execution guide](docs/phase-e1a2-execution-guide.md).

### CI — SDK verify only (Phase E.1a.3)

GitHub Actions workflow [`.github/workflows/sdk-verify.yml`](.github/workflows/sdk-verify.yml) runs on pushes and PRs to `main` / `master`: `npm ci`, workspace dependency policy check, SDK typecheck, `release:dry-run`, and tarball install smoke. **No npm publish and no repository secrets.**

| Script | Purpose |
|--------|---------|
| `npm run ci:verify-sdk` | Local one-liner matching CI steps (parity check). |

Details: [Phase E.1a.3 CI verify](docs/phase-e1a3-ci-verify.md).

### npm publish — gated automation (Phase E.1a.4)

Workflow [`.github/workflows/sdk-publish.yml`](.github/workflows/sdk-publish.yml) publishes `@sammati/*` **only** when:

- a tag matching `sdk-v*` is pushed, or
- **`workflow_dispatch`** is used (default **dry-run only**; turn off `dry_run_only` for a real publish from the UI).

It runs **`ci:verify-sdk`**, registry manifest prep, **`npm publish --dry-run`**, then (when allowed) real **`npm publish`** in dependency order using the GitHub Environment **`npm`** and **`NPM_TOKEN`**. Post-publish **registry** install smoke runs in CI.

Runbook: [Phase E.1a.4 publish workflow](docs/phase-e1a4-publish-workflow.md). **First real release:** [execution and validation guide](docs/phase-e1a4-first-real-publish-execution-guide.md). Also: [readiness](docs/phase-e1a4-pre-release-first-publish-readiness.md), [one-page checklist](docs/phase-e1a4-first-publish-checklist.md).

| Script | Purpose |
|--------|---------|
| `npm run release:verify-tag` | Confirm `sdk-v*` matches all SDK `package.json` versions (`RELEASE_TAG` or `GITHUB_REF`). |
| `npm run release:prepare-registry` | **Local only with care:** rewrite manifests for registry (CI does this automatically). |

## What’s in scope (frozen)

### Phase A — Core consent ledger

- PostgreSQL schema and migrations
- Domain rules, repositories, single-transaction lifecycle writes
- Bearer API key auth (hashed keys; raw key shown once at provision)
- Idempotency on writes
- Transactional outbox row per event (`proof.pending`)
- Read APIs: consent status and timeline (cursor pagination)
- Bootstrap: create company + first API key

### Phase B — Proof pipeline

- Outbox claim loop with retry and poison → `FAILED`
- Canonical leaf hashing + Merkle batch + inclusion paths
- Tables: `proof_batches`, `proof_batch_events`, `proof_paths`
- Mock anchor worker (`ANCHORED` / `CONFIRMED`)
- Proof read APIs and `POST /v1/proofs/verify`
- Scripts: `npm run worker:proof`, `npm run worker:anchor-mock`

### Phase C.3 — Webhook delivery subsystem

- Endpoint registry with per-company subscriptions
- HMAC SHA-256 signatures with timestamp headers
- Secret rotation support (current + previous secret)
- Async delivery worker with retries and dead-letter handling
- APIs for create/list/update/rotate/test endpoint operations
- Script: `npm run worker:webhook`

### Phase C.4 — Hosted widget runtime layer

- Hosted iframe runtime route + secure bootstrap API
- Canonical policy rendering from published artifact versions only
- Versioned postMessage runtime contract (`widget.ready`, `widget.loaded`, etc.)
- Session-token-only submit flow through existing widget session endpoint
- Runtime docs and validation checklist for embed security and terminal states

## Out of scope (later)

- Real blockchain / L2 anchoring (production adapter)
- Kafka, CQRS, microservice split
- Customer SDK (runtime), admin dashboards
- Storing business PII payloads in Sammati

## Local run (no Docker)

1. Set `DATABASE_URL`
2. `npm install` then `npm run migrate:up`
3. `npm run company:bootstrap -- "Company Name"` (save `rawApiKey`)
4. `npm run dev` (default port **3000**; override with `PORT`)

**Phase B locally:** in separate terminals, same `DATABASE_URL`:

- `npm run worker:proof`
- `npm run worker:anchor-mock`

## Docker

```cmd
docker compose up --build
```

API on port **3000**, Postgres on **5432** (see `docker-compose.yml`).

## NPM utilities

| Script | Purpose |
|--------|---------|
| `npm run apikey:create -- <company_id>` | Add API key for existing company |
| `npm run company:bootstrap -- "Name"` | Company + first key (one-shot raw key) |
| `npm run test:lifecycle -- <raw_api_key>` | Sample grant → update → revoke + reads |
| `npm run test:proof-verification` | Unit checks for Merkle + leaf hash |
| `npm run worker:proof` | Proof outbox worker |
| `npm run worker:anchor-mock` | Mock anchor worker |
| `npm run worker:webhook` | Webhook delivery worker |
| `npm run test:webhooks` | Webhook signatures, retry, dead-letter, concurrency |
| `npm run test:widget-runtime` | Hosted widget runtime flow, security, and contracts |

## API reference

- Phase A: [`docs/phase-a-api-contracts.md`](docs/phase-a-api-contracts.md)
- Phase B: [`docs/phase-b-api-contracts.md`](docs/phase-b-api-contracts.md)

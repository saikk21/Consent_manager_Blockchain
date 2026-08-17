# Architecture overview

Single-document summary of the **frozen** implementation scope in this repo:

- Phase A: Core consent ledger
- Phase B: Async proof pipeline with mock anchoring

Out of scope remains unchanged: blockchain integration, Kafka, CQRS, microservices, SDK runtime, dashboards.

## System intent

Sammati records and verifies consent lifecycle metadata without storing business PII payloads.

Core guarantees:

1. Every consent action is recorded
2. Consent history is append-only and versioned
3. Proof generation is asynchronous
4. Tampering is independently detectable

## Module boundaries (modular monolith)

1. **API**
   - Auth: `Authorization: Bearer <api_key>`
   - Lifecycle: `POST /v1/consents/grant|update|revoke`
   - Reads: `GET /v1/consents/status`, `GET /v1/consents/timeline`
   - Proofs (Phase B): `GET /v1/proofs/...`, `POST /v1/proofs/verify`

2. Domain module
   - transition rules
   - idempotency request canonicalization
   - canonical leaf hashing

3. Persistence module
   - repositories
   - transactional write paths
   - outbox persistence
   - proof tables

4. Background worker module
   - proof outbox claim/retry loop
   - merkle batch construction
   - proof persistence

5. Mock anchor worker module
   - sealed batch claim
   - simulated anchor transition to confirmed

## Data ownership boundaries

- Company systems own user/business data.
- Sammati stores:
  - consent identity references (`company_id`, `external_user_id`, `purpose_code`)
  - consent versions/events
  - idempotency records
  - outbox events
  - proof artifacts (batch, leaf mapping, path)

## Phase A — Data and write path

- `consents` is current pointer + identity
- `consent_versions` is immutable timeline metadata
- `events` is immutable event log for proofing
- `outbox` is async handoff

Write transaction atomically does:

- idempotency reserve/resolve
- consent lock/load/create
- event insert
- version insert
- consent current pointer update
- outbox insert

## Phase B — Proof and anchor (mock)

Additional entities:

- `proof_batches`
- `proof_batch_events`
- `proof_paths`

Proof flow:

- outbox claim (`proof.pending`)
- event canonicalization -> leaf hash
- merkle root + inclusion paths
- proof persistence
- event proof status update to `READY`
- mock anchor confirmation

## Phase C.1 — Policy artifacts

Implemented in this repo:

- Versioned policy artifacts with lifecycle: `DRAFT` → `PUBLISHED` → `DEPRECATED`
- Deterministic hashing:
  - `policy_content_hash` (canonical content hash)
  - `render_hash` (derived for widget/audit linkage)
- REST endpoints:
  - `POST /v1/policies`
  - `POST /v1/policies/:policyRef/versions/:version/publish`
  - `GET /v1/policies/:policyRef/versions/:version`
  - `GET /v1/policies/:policyRef/versions`

## Phase C.2 — Widget session backend

Implemented in this repo:

- `widget_sessions` lifecycle state machine:
  - `ISSUED`, `STARTED`, `CONSUMED`, `EXPIRED`, `CANCELLED`
- signed session token generation and verification (`kid` aware)
- origin binding + expiry + replay protections (`jti`/nonce checks)
- backend APIs:
  - `POST /v1/widget/sessions`
  - `GET /v1/widget/sessions/:sessionId`
  - `POST /v1/widget/sessions/:sessionId/submit`

Deferred (by design):

- iframe UI/postMessage implementation
- webhook session events
- SDK packaging

## Operational model

Running processes:

1. API server
2. proof worker
3. mock anchor worker

Minimum environment:

- PostgreSQL
- Node.js runtime

## Freeze status

| Phase | Status |
|-------|--------|
| Phase A — Core ledger | Frozen |
| Phase B — Proof pipeline + mock anchor | Frozen (incl. poison → `FAILED`) |

**API index:** [`phase-a-api-contracts.md`](phase-a-api-contracts.md), [`phase-b-api-contracts.md`](phase-b-api-contracts.md), [`phase-c1-policy-artifacts.md`](phase-c1-policy-artifacts.md), [`phase-c2-widget-session-contracts.md`](phase-c2-widget-session-contracts.md)


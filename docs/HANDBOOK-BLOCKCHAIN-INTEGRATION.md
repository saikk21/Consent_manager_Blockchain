# Sammati Ledger — Blockchain & Anchoring Integration Handbook

| Field | Value |
|--------|--------|
| **Document** | HANDBOOK-BLOCKCHAIN-INTEGRATION |
| **Audience** | Blockchain / infrastructure engineers extending proof anchoring |
| **Prerequisites** | [HANDBOOK-PLATFORM-ARCHITECTURE-AND-API](./HANDBOOK-PLATFORM-ARCHITECTURE-AND-API.md), [HANDBOOK-DB-SCHEMA-AND-MIGRATIONS](./HANDBOOK-DB-SCHEMA-AND-MIGRATIONS.md) |

---

## Table of contents

1. [Purpose & principles](#1-purpose--principles)  
2. [What the ledger already guarantees](#2-what-the-ledger-already-guarantees)  
3. [Current off-chain proof pipeline](#3-current-off-chain-proof-pipeline)  
4. [Integration boundaries (must not break)](#4-integration-boundaries-must-not-break)  
5. [What your team implements](#5-what-your-team-implements)  
6. [Smart contracts vs chain client only](#6-smart-contracts-vs-chain-client-only)  
7. [Suggested integration sequence](#7-suggested-integration-sequence)  
8. [Data you will anchor](#8-data-you-will-anchor)  
9. [Testing & acceptance criteria](#9-testing--acceptance-criteria)  
10. [Release coordination](#10-release-coordination)  

---

## 1. Purpose & principles

This document tells a **permissioned blockchain / anchoring team** how to extend Sammati **without** breaking company integrations, widget flows, or consent APIs.

**Principles**

1. **Ledger remains source of truth** for consent events and Merkle batches **before** any chain write.  
2. **Widget and company backends never sign chain transactions** as part of consent UX.  
3. **All chain-specific code** should live in **workers / adapters**, not in HTTP route handlers or hosted widget HTML.  
4. **Schema changes** are additive migrations only (see DB handbook).

---

## 2. What the ledger already guarantees

- Each consent mutation creates an **`events`** row with `event_hash`, `version_no`, and `proof_status` (initially `PENDING`).
- After the proof worker runs, events receive Merkle paths and linkage to **`proof_batches`** (`proof_batch_events`, `proof_paths`).
- **`proof_batches`** includes `anchor_mode` (default `MOCK`), `anchor_status`, `anchor_ref`, timestamps for send/confirm/fail.
- **Outbox** row `topic: "proof.pending"` drives asynchronous proof batching (`ConsentLifecycleService` enqueue).

---

## 3. Current off-chain proof pipeline

```text
recordConsent (tx)
  → insert event + consent_versions + update consent
  → enqueue outbox (topic proof.pending, aggregate_id = event.id)

ProofWorkerService (separate process)
  → claim outbox rows
  → fetch events, compute leaf hashes, Merkle root
  → write proof_batches / proof_batch_events / proof_paths
  → mark outbox done, update event.proof_batch_id / proof_status
  → optional webhook proof.ready

MockAnchorWorkerService (separate process)
  → simulates anchor lifecycle for batches
  → may emit proof.anchor_confirmed webhooks
```

**Source files:** `src/services/consentLifecycle/consentLifecycleService.ts`, `src/services/proof/proofWorkerService.ts`, `src/services/proof/mockAnchorWorkerService.ts`, `src/persistence/repositories/proofRepository.ts`, `src/persistence/repositories/outboxRepository.ts`.

---

## 4. Integration boundaries (must not break)

| Surface | Rule |
|---------|------|
| **HTTP JSON** for consent, policy, widget session create/get, proofs read, webhooks | Do not change field names or status codes without API versioning. |
| **Widget** `GET /widget/hosted`, `POST /v1/widget/runtime/bootstrap`, `POST .../submit` | No new required headers on existing flows; no change to postMessage envelope (`@sammati/shared-core` `WIDGET_MESSAGE_VERSION` / `WIDGET_EVENTS`). |
| **Session token claims** | Do not add chain-specific claims without a **versioned** token format and migration plan. |
| **Company integration** | Companies poll webhooks + proof APIs; chain is **opaque** to them unless you expose new **optional** read fields. |

---

## 5. What your team implements

| Workstream | Description |
|------------|-------------|
| **Chain adapter** | Module used by a worker to `SUBMIT_ROOT` / `CONFIRM_TX` (names illustrative) against your chain RPC or contracts. |
| **Anchor worker** | Replace or extend `MockAnchorWorkerService`: load `proof_batches` in `OPEN`/`SEALED` states, submit anchor, persist `anchor_ref`, transition `anchor_status`, handle retries. |
| **Failure & retry policy** | Align with existing outbox / delivery patterns (backoff, dead-letter semantics). |
| **Observability** | Metrics/logs for anchor submissions; correlate `batch_id` / `root_hash` with chain tx id. |
| **Verification tooling** | Optional: CLI or API to verify on-chain commitment matches `root_hash` returned by `GET /v1/proofs/batches/:batchId`. |

---

## 6. Smart contracts vs chain client only

| Model | When to use |
|-------|-------------|
| **No smart contract** | Chain stores only an **anchor reference** (e.g. tx hash + log) pointing at `root_hash` you already persist in Postgres. Verification = RPC read + hash compare. |
| **Minimal verification contract** | On-chain registry of batch roots; **verification** of inclusion still uses Merkle proofs off-chain (`POST /v1/proofs/verify` today). |
| **Rich on-chain state** | Only if product requires on-chain consent state — **high coordination cost** with ledger; usually **avoid** duplicating consent rows on-chain. |

**Default recommendation for Sammati-shaped systems:** anchor **Merkle roots** (and optionally batch metadata hashes), keep **event payloads** and GDPR-sensitive fields **off-chain**.

---

## 7. Suggested integration sequence

1. **Read-only shadow mode:** worker logs “would anchor” `root_hash` for batch X; no chain calls.  
2. **Testnet anchoring:** write `anchor_ref`, `anchor_status` transitions; run `worker:anchor-mock` logic beside real adapter behind feature flag.  
3. **Webhook `proof.anchor_confirmed`:** ensure payload includes everything integrators need (`batch_id`, `root_hash`, `anchor_ref`, chain id).  
4. **Production:** rate limits, key management (HSM/KMS), monitoring, runbook.

---

## 8. Data you will anchor

**Minimum viable anchor payload**

- `root_hash` from `proof_batches.root_hash` (after batch sealed).  
- Optional: batch metadata (`batch_no`, `tree_algo`, event count).

**Do not anchor**

- Raw PII (`external_user_id` in clear text) unless legally required and approved.

---

## 9. Testing & acceptance criteria

- [ ] Unit tests for adapter against chain emulator / localnet.  
- [ ] Integration: proof worker produces batch → anchor worker updates row → `proof.anchor_confirmed` fires (if subscribed).  
- [ ] Idempotent anchor submission (same batch not double-paid on retry).  
- [ ] Rollback: failed anchor leaves batch in retryable state, does not corrupt `events`.  
- [ ] Load test: outbox backlog does not starve consent writes (writes remain fast).

---

## 10. Release coordination

1. **DB migrations** land first (additive columns if needed — see DB handbook).  
2. **Worker deployment** canary with feature flag `ANCHOR_ENABLED`.  
3. **Docs:** update this handbook’s sections when anchor payload or webhooks change.  
4. **API version:** if new **read** endpoints are added for chain proofs, version path (`/v2/...`) or document optional fields in existing GET responses.

---

*End of Blockchain Integration Handbook.*

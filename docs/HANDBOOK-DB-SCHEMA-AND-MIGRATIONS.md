# Sammati Ledger — Database Schema & Migrations Handbook

| Field | Value |
|--------|--------|
| **Document** | HANDBOOK-DB-SCHEMA-AND-MIGRATIONS |
| **Audience** | DBAs, backend engineers, blockchain team (schema extensions) |
| **Source of truth** | `src/persistence/migrations/*.cjs` (node-pg-migrate) |

---

## Table of contents

1. [Purpose](#1-purpose)  
2. [Running migrations](#2-running-migrations)  
3. [Migration order & files](#3-migration-order--files)  
4. [Entity overview](#4-entity-overview)  
5. [Tables by migration](#5-tables-by-migration)  
6. [Enums & constraints](#6-enums--constraints)  
7. [Indexes (summary)](#7-indexes-summary)  
8. [Extending for blockchain / anchoring](#8-extending-for-blockchain--anchoring)  
9. [Rollback policy](#9-rollback-policy)  
10. [Parity with other environments](#10-parity-with-other-environments)  

---

## 1. Purpose

Describe the **relational model** behind the Sammati ledger service and how to **evolve** it safely. This document reflects migrations as implemented in the repository; if code and doc diverge, **migrations win**.

---

## 2. Running migrations

**Environment:** `DATABASE_URL` must be set (see `src/config/env.ts`).

```bash
# Apply all pending migrations
npm run migrate:up

# Roll back last batch (use with care in shared envs)
npm run migrate:down
```

Migrations live in: `src/persistence/migrations/`

---

## 3. Migration order & files

| Order | File | Summary |
|-------|------|---------|
| 001 | `001_init_ledger.cjs` | Core ledger: companies, consents, events, consent_versions, idempotency_keys, outbox |
| 002 | `002_company_api_keys.cjs` | `company_api_keys` for Bearer API key auth |
| 003 | `003_proof_pipeline.cjs` | `proof_batches`, `proof_batch_events`, `proof_paths`; FK `events.proof_batch_id` |
| 004 | `004_policy_artifacts.cjs` | `policy_artifacts` + immutability trigger for published content |
| 005 | `005_widget_sessions.cjs` | `widget_sessions` + enum `widget_session_state` |
| 006 | `006_webhooks.cjs` | `webhook_endpoints`, `webhook_deliveries` + enums |

---

## 4. Entity overview

```text
companies
  ├── company_api_keys
  ├── policy_artifacts
  ├── widget_sessions  ──► consents (optional FK after consume) / events
  ├── consents
  │     ├── events
  │     ├── consent_versions
  │     └── (via events) proof_batch_events, proof_paths
  ├── idempotency_keys
  ├── outbox
  ├── webhook_endpoints
  └── webhook_deliveries
```

---

## 5. Tables by migration

### 5.1 `001_init_ledger.cjs`

| Table | Purpose |
|-------|---------|
| **companies** | Tenant root (`id`, `name`, timestamps). |
| **consents** | One timeline per `(company_id, external_user_id, purpose_code)`; `current_version_no`, `current_status`. |
| **events** | Append-only consent events; `event_type`, `version_no`, `event_hash`, `proof_status`, optional `proof_batch_id`. |
| **consent_versions** | Links consent version to `events.id`, `action`, `policy_ref`, `occurred_at`. |
| **idempotency_keys** | Per-company idempotency for consent writes (`idempotency_key`, `request_hash`, response snapshot). |
| **outbox** | Async queue: `topic`, `aggregate_type`, `aggregate_id`, `payload`, retry fields (`proof.pending` used for proof worker). |

### 5.2 `002_company_api_keys.cjs`

| Table | Purpose |
|-------|---------|
| **company_api_keys** | Hashed API keys (`key_hash` unique), `key_prefix`, `status`, `last_used_at`. |

### 5.3 `003_proof_pipeline.cjs`

| Table | Purpose |
|-------|---------|
| **proof_batches** | Merkle batch: `batch_no`, `state`, `event_count`, `root_hash`, `tree_algo`, anchor fields (`anchor_mode` default `MOCK`, `anchor_status`, `anchor_ref`, timestamps). |
| **proof_batch_events** | Membership of an `events` row in a batch (`leaf_index`, `leaf_hash`). |
| **proof_paths** | Merkle path material per `event_id` for verification APIs. |

### 5.4 `004_policy_artifacts.cjs`

| Table | Purpose |
|-------|---------|
| **policy_artifacts** | Versioned policy JSON (`policy_ref`, `version`, `state` DRAFT/PUBLISHED/DEPRECATED), `locales` JSONB, `policy_content_hash`, `ui_schema_version`. Trigger prevents mutating published content fields. |

### 5.5 `005_widget_sessions.cjs`

| Table | Purpose |
|-------|---------|
| **widget_sessions** | Browser session: `external_user_id`, `purpose_code`, `policy_ref`/`policy_version`, `locale`, `allowed_origin`, `render_hash`, `nonce`, `status`, TTL, optional consent linkage after submit. Unique `(company_id, nonce)`. |

### 5.6 `006_webhooks.cjs`

| Table | Purpose |
|-------|---------|
| **webhook_endpoints** | HTTPS URL, `subscribed_events` JSONB, signing secret, status ACTIVE/PAUSED. |
| **webhook_deliveries** | Delivery attempts per endpoint + logical `event_id`, retry counters, HTTP metadata. |

---

## 6. Enums & constraints

| Enum / type | Values / notes |
|-------------|----------------|
| `widget_session_state` | `ISSUED`, `STARTED`, `CONSUMED`, `EXPIRED`, `CANCELLED` |
| `policy_state` | `DRAFT`, `PUBLISHED`, `DEPRECATED` |
| `proof_batch_state` | `OPEN`, `SEALED`, `ANCHORED`, `FAILED` |
| `proof_anchor_status` | `NOT_SENT`, `SENT`, `CONFIRMED`, `FAILED` |
| `webhook_endpoint_status` | `ACTIVE`, `PAUSED` |
| `webhook_delivery_status` | `PENDING`, `CLAIMED`, `DELIVERED`, `DEAD_LETTER` |

---

## 7. Indexes (summary)

- Frequent access paths indexed: consent identity, events by company/time, outbox by `(status, next_attempt_at)`, widget sessions by company/status/expiry, policy by company/ref, webhook deliveries by retry queue, etc.  
- See each migration file for the authoritative index list.

---

## 8. Extending for blockchain / anchoring

**Rules**

1. **New migration only** — never edit applied migration files in shared environments.  
2. **Prefer additive** columns (e.g. `anchor_chain_id`, `anchor_tx_hash`, `anchor_block_number`) on `proof_batches` or a child table `proof_batch_anchors`.  
3. **Avoid** storing large payloads on-chain; store references only.  
4. **Backfill** via one-off job or nullable columns with defaults.  
5. **Foreign keys** — if you add tables referencing `proof_batches` or `events`, use `ON DELETE` semantics consistent with immutability (usually `RESTRICT` on events).

**Example extension areas**

- `proof_batches`: production anchor metadata (today MOCK-oriented columns exist).  
- New table `anchor_submissions` if you need multiple submission attempts per batch.  
- **Do not** add blockchain columns to `widget_sessions` unless strictly necessary (keeps widget layer independent).

---

## 9. Rollback policy

- `migrate:down` is for **development**; production rollbacks should be **forward fixes** (new migration) except in controlled maintenance windows.  
- Always snapshot / backup before migrating production.

---

## 10. Parity with other environments

Blockchain and staging databases must run the **same migration sequence** from this repository. Do **not** hand-replicate schema from this markdown — run `npm run migrate:up` against the target database.

---

*End of DB Schema & Migrations Handbook.*

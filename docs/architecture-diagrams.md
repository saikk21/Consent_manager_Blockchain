# Architecture diagrams

Mermaid sources for README and design reviews. Render in GitHub, VS Code, or any Mermaid-capable viewer.

---

## 1 — High-level components

```mermaid
flowchart LR
  A[Company Client] -->|Bearer API key| B[API Server]
  B --> C[(PostgreSQL)]
  B -->|outbox insert| C
  D[Proof Worker] -->|claim proof.pending| C
  D -->|proof batch + paths| C
  E[Mock Anchor Worker] -->|claim SEALED batch| C
  E -->|confirm anchor| C
  F[Auditor/Verifier] -->|proof read APIs| B
```

## 2 — Phase A: write transaction (sequence)

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant DB

  Client->>API: POST /v1/consents/grant|update|revoke
  API->>DB: BEGIN
  API->>DB: reserve idempotency key
  API->>DB: lock/load consent identity
  API->>DB: insert event
  API->>DB: insert consent_version
  API->>DB: update consents current pointer
  API->>DB: insert outbox(proof.pending)
  API->>DB: finalize idempotency response
  API->>DB: COMMIT
  API-->>Client: 200 (proofStatus=PENDING)
```

## 3 — Phase B: proof + mock anchor (sequence)

```mermaid
sequenceDiagram
  participant W as Proof Worker
  participant DB
  participant A as Anchor Worker

  W->>DB: claim outbox rows NEW->CLAIMED (SKIP LOCKED)
  W->>DB: fetch referenced events
  W->>W: canonicalize + leaf hashes
  W->>W: build merkle tree
  W->>DB: insert proof_batches(state=SEALED)
  W->>DB: insert proof_batch_events + proof_paths
  W->>DB: update events proof_status=READY
  W->>DB: outbox CLAIMED->DONE

  A->>DB: claim sealed batch (NOT_SENT->SENT)
  A->>A: create mock anchor ref
  A->>DB: batch state=ANCHORED, anchor_status=CONFIRMED
```

## 4 — Outbox: retry and terminal states

```mermaid
stateDiagram-v2
  [*] --> NEW
  NEW --> CLAIMED: claim loop
  CLAIMED --> DONE: proof persisted
  CLAIMED --> NEW: transient error + backoff
  CLAIMED --> FAILED: max attempts / poison
  DONE --> [*]
  FAILED --> [*]
```

## 5 — `proof_batches` state machine

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> SEALED: merkle built
  SEALED --> ANCHORED: mock anchor confirmed
  OPEN --> FAILED: unrecoverable batch failure
  SEALED --> FAILED: unrecoverable anchor/proof failure
  ANCHORED --> [*]
  FAILED --> [*]
```

---

## 6 — Phase C.2 widget session lifecycle

```mermaid
stateDiagram-v2
  [*] --> ISSUED
  ISSUED --> STARTED: first valid submit/start
  STARTED --> CONSUMED: consent recorded
  ISSUED --> EXPIRED: ttl exceeded
  STARTED --> EXPIRED: ttl exceeded
  ISSUED --> CANCELLED: explicit cancel
  STARTED --> CANCELLED: explicit cancel
  CONSUMED --> [*]
  EXPIRED --> [*]
  CANCELLED --> [*]
```

## 7 — Phase C.2 submit sequence (backend-only)

```mermaid
sequenceDiagram
  participant AppBE as Company Backend
  participant API as Sammati API
  participant DB
  participant Ledger as Consent Lifecycle Service

  AppBE->>API: POST /v1/widget/sessions (Bearer API key)
  API->>DB: create ISSUED session + nonce
  API-->>AppBE: sessionId + sessionToken + renderHash

  AppBE->>API: POST /v1/widget/sessions/{id}/submit (session token + action)
  API->>API: verify token signature/exp/kid
  API->>API: verify Origin == allowed_origin
  API->>DB: lock session + lifecycle checks
  API->>Ledger: record consent (Phase A tx path)
  Ledger->>DB: event/version/outbox/idempotency
  API->>DB: mark session CONSUMED + link consent/event
  API-->>AppBE: consent result (proofStatus=PENDING)
```

---

## See also

- [Architecture overview](architecture-overview.md)
- [Phase A API contracts](phase-a-api-contracts.md) · [Phase B API contracts](phase-b-api-contracts.md)


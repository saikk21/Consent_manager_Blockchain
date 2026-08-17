# Phase B — Runtime validation (freeze record)

This document records **what was exercised** to freeze Phase B: async proofs, mock anchor, retries, concurrency, and poison handling.

---

## Objectives

1. Proof correctness (leaf, path, root)
2. Retry / backoff behavior
3. Worker concurrency (`SKIP LOCKED`, no duplicate proof rows)
4. Verification API (`POST /v1/proofs/verify`) pass/fail
5. Mock anchor transitions (`SEALED` → `ANCHORED`, `NOT_SENT` → `CONFIRMED`)
6. Poison message terminal semantics (`outbox.status = FAILED`)

---

## Observed outcomes

### Proof generation

- `events.proof_status` → `READY` after worker processing
- `outbox` rows for `topic = 'proof.pending'` → `DONE` on success
- `proof_batches`, `proof_batch_events`, `proof_paths` populated

### Anchor (mock)

- Batches reached `state = ANCHORED` and `anchor_status = CONFIRMED`
- `anchor_ref` pattern: `mock_tx_<batch_no>_…`

### Concurrency

- No duplicate mappings:

```sql
select event_id, count(*) from proof_paths group by event_id having count(*) > 1;
select event_id, count(*) from proof_batch_events group by event_id having count(*) > 1;
```

Expected: **zero rows**.

### Poison / terminal failure

- Outbox row pointing at a **non-existent** `aggregate_id` (event id) after worker restart with poison handling:
  - `status = FAILED`
  - `last_error` documents missing event reference
  - confirms terminal semantics (not infinite retry)

---

## Freeze verdict

Phase B behavior for this repository is **validated and frozen** for:

- modular monolith + two worker processes
- PostgreSQL outbox + proof tables
- mock anchoring only (no production chain)

**Contracts:** [`phase-b-api-contracts.md`](phase-b-api-contracts.md)  
**Diagrams:** [`architecture-diagrams.md`](architecture-diagrams.md)

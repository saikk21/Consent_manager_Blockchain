# Phase C.3 Retry Semantics

## Delivery States

- `PENDING`: queued and eligible by `next_attempt_at`
- `CLAIMED`: reserved by worker (`FOR UPDATE SKIP LOCKED`)
- `DELIVERED`: terminal success (2xx)
- `DEAD_LETTER`: terminal failure

## Retry Classification

Retryable:

- Network/transport errors
- HTTP `429`
- HTTP `5xx`

Terminal:

- HTTP `4xx` except `429`
- Attempts exhausted (`attempt_count >= max_attempts`)

## Backoff

- Formula: `min(cap, base * 2^(attempt-1)) + jitter`
- Base: 2 seconds
- Cap: 5 minutes
- Jitter: random up to 20%

## Concurrency Safety

Worker claims rows with:

- status = `PENDING`
- `next_attempt_at <= now()`
- `FOR UPDATE SKIP LOCKED`

This prevents duplicate processing across concurrent workers.

## Failure and recovery examples

- Receiver returns `500`:
  - delivery goes `CLAIMED -> PENDING`
  - `attempt_count` increments
  - `next_attempt_at` moves forward with backoff
- Receiver returns `400`:
  - delivery goes `CLAIMED -> DEAD_LETTER` (terminal)
- Endpoint recovers:
  - new events are delivered normally
  - previously dead-lettered events remain terminal unless manually replayed

## Replay safety

- Worker reprocessing of same `(endpoint_id,event_id)` cannot create duplicate row due to unique constraint.
- Concurrent workers cannot claim same `PENDING` row due to `FOR UPDATE SKIP LOCKED`.


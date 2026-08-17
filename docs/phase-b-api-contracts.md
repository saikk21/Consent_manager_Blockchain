# Phase B — API contracts

HTTP reference for **proof retrieval** and **local Merkle verification**. All routes require the same Bearer API key as Phase A.

**Prerequisite:** `npm run worker:proof` and `npm run worker:anchor-mock` (or equivalent) so events move to `proofStatus: READY` and batches reach mock `ANCHORED`.

---

## `GET /v1/proofs/events/:eventId`

Returns proof material for one event.

### `200` — proof pending

```json
{
  "eventId": "uuid",
  "proofStatus": "PENDING"
}
```

### `200` — proof ready

```json
{
  "eventId": "uuid",
  "proofStatus": "READY",
  "proofBatch": {
    "batchId": "uuid",
    "batchNo": "42",
    "state": "ANCHORED",
    "rootHash": "hex"
  },
  "leaf": {
    "index": 0,
    "hash": "hex"
  },
  "path": {
    "hashes": ["hex"],
    "positions": ["L", "R"]
  },
  "anchor": {
    "mode": "MOCK",
    "status": "CONFIRMED",
    "ref": "mock_tx_42_…",
    "confirmedAt": "2026-05-07T10:00:10.000Z"
  }
}
```

### `404`

Event not found.

### `401`

Missing or invalid API key.

---

## `GET /v1/proofs/consents/:consentId`

Lists proof status per event version for a consent. **Scoped:** `consentId` must belong to the authenticated company.

| Query | Meaning |
|-------|---------|
| `cursor` | Last `versionNo` seen (default `0`) |
| `limit` | Page size (capped) |

**Example `200`:**

```json
{
  "consentId": "uuid",
  "items": [
    {
      "versionNo": 1,
      "eventId": "uuid",
      "eventType": "CONSENT_GRANTED",
      "proofStatus": "READY",
      "proofBatchId": "uuid",
      "rootHash": "hex"
    }
  ],
  "page": {
    "limit": 20,
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

## `GET /v1/proofs/batches/:batchId`

Batch metadata for audits and debugging.

**Example `200`:** rows from `proof_batches` (state, anchor fields, root, counts, timestamps).

---

## `POST /v1/proofs/verify`

Recomputes root from a leaf hash and inclusion path; does not read the DB.

**Request:**

```json
{
  "leaf_hash": "hex",
  "path_hashes": ["hex"],
  "path_positions": ["L", "R"],
  "root_hash": "hex"
}
```

**Response:**

```json
{ "valid": true }
```

or `{ "valid": false }` if the path does not reproduce `root_hash`.

---

## Operational scripts

| Script | Role |
|--------|------|
| `npm run worker:proof` | Claim `proof.pending` outbox, build Merkle batch, persist paths |
| `npm run worker:anchor-mock` | Move sealed batches to mock `ANCHORED` / `CONFIRMED` |

See also [`phase-b-runtime-validation.md`](phase-b-runtime-validation.md).

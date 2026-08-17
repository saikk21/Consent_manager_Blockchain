# Phase A — API contracts

HTTP reference for **consent lifecycle** and **consent reads**. Authentication and idempotency rules apply to all write routes.

**Related:**

- Proof and verification endpoints (Phase B): [`phase-b-api-contracts.md`](phase-b-api-contracts.md)
- Policy artifact endpoints (Phase C.1): [`phase-c1-policy-artifacts.md`](phase-c1-policy-artifacts.md)

---

## Authentication

All routes require:

```http
Authorization: Bearer <RAW_API_KEY>
```

Clients must not send `company_id`; it is resolved from the API key.

---

## Writes — idempotency

These routes require:

```http
Idempotency-Key: <unique-per-logical-operation>
```

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/consents/grant` | First grant / re-grant after revoke |
| `POST` | `/v1/consents/update` | Update while `GRANTED` |
| `POST` | `/v1/consents/revoke` | Revoke while `GRANTED` |

**Request body (all three):**

```json
{
  "external_user_id": "ext-user-1",
  "purpose_code": "KYC",
  "policy_ref": "policy-v1",
  "occurred_at": "2026-05-06T10:00:00.000Z"
}
```

**Success response (example):**

```json
{
  "consentId": "uuid",
  "eventId": "uuid",
  "versionNo": 1,
  "currentStatus": "GRANTED",
  "proofStatus": "PENDING"
}
```

`proofStatus` becomes `READY` after Phase B workers process the outbox (see Phase B docs).

---

## Reads — consent status

| Method | Path |
|--------|------|
| `GET` | `/v1/consents/status?external_user_id=&purpose_code=` |

**Example response:**

```json
{
  "consentId": "uuid",
  "externalUserId": "ext-user-1",
  "purposeCode": "KYC",
  "currentVersionNo": 3,
  "currentStatus": "REVOKED",
  "updatedAt": "2026-05-06T10:03:02.100Z"
}
```

---

## Reads — consent timeline (paginated)

| Method | Path |
|--------|------|
| `GET` | `/v1/consents/timeline?external_user_id=&purpose_code=&cursor=&limit=` |

- `cursor`: last `versionNo` seen (default `0`); next page uses returned `nextCursor`.
- `limit`: max items per page (bounded in API).

**Example response:**

```json
{
  "consentId": "uuid",
  "externalUserId": "ext-user-1",
  "purposeCode": "KYC",
  "items": [
    {
      "versionNo": 1,
      "action": "GRANT",
      "policyRef": "policy-v1",
      "occurredAt": "2026-05-06T10:00:00.000Z",
      "recordedAt": "2026-05-06T10:00:00.900Z",
      "eventId": "uuid",
      "eventType": "CONSENT_GRANTED",
      "eventHash": "hex",
      "proofStatus": "PENDING"
    }
  ],
  "page": {
    "limit": 2,
    "nextCursor": 1,
    "hasMore": true
  }
}
```

---

## Idempotency semantics

| Case | Result |
|------|--------|
| Same `Idempotency-Key` + same canonical body | Replay stored response (`200`) |
| Same key + different body | `409 Conflict` |

**Example (`curl`, bash):**

```bash
curl -X POST "http://localhost:3000/v1/consents/grant" \
  -H "Authorization: Bearer <RAW_API_KEY>" \
  -H "Idempotency-Key: grant-001" \
  -H "Content-Type: application/json" \
  -d '{"external_user_id":"ext-user-1","purpose_code":"KYC","policy_ref":"policy-v1","occurred_at":"2026-05-06T10:00:00.000Z"}'
```

Replace host/port if `PORT` is not `3000`.

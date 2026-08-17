# Phase C.2 — Widget session backend contracts

Scope implemented in C.2:

- `widget_sessions` table + lifecycle states
- signed token generation/verification with `kid`
- origin + expiry + replay checks
- session lifecycle service
- REST APIs (backend only; no iframe UI)

## Session lifecycle states

`ISSUED -> STARTED -> CONSUMED`  
`ISSUED|STARTED -> EXPIRED|CANCELLED`

Terminal states:

- `CONSUMED`
- `EXPIRED`
- `CANCELLED`

## Token model

- signed token contains `jti`, `nonce`, `company_id`, `allowed_origin`, `exp`, policy/user bindings
- verification checks:
  - signature (`kid` key lookup)
  - token expiry
  - claim integrity (`iss`, `aud`)
  - session id match
  - nonce match
  - origin match

## REST APIs

### 1) Create session

`POST /v1/widget/sessions`  
Auth: Bearer API key  
Headers: `Idempotency-Key`

Request:

```json
{
  "external_user_id": "ext-user-1",
  "purpose_code": "KYC",
  "policy_ref": "kyc-consent",
  "policy_version": 1,
  "locale": "en-IN",
  "allowed_origin": "https://app.example.com",
  "environment": "dev",
  "ttl_seconds": 600
}
```

Response `201`:

```json
{
  "sessionId": "uuid",
  "expiresAt": "ISO",
  "render": { "renderHash": "hex", "uiSchemaVersion": 1 },
  "token": { "sessionToken": "JWS..." }
}
```

### 2) Get session

`GET /v1/widget/sessions/{sessionId}`  
Auth: Bearer API key (same tenant only)

Response `200`:

```json
{
  "sessionId": "uuid",
  "status": "ISSUED",
  "expiresAt": "ISO",
  "consent": null
}
```

### 3) Submit session

`POST /v1/widget/sessions/{sessionId}/submit`  
Auth: **session token in request body** (not API key)

Request:

```json
{
  "session_token": "JWS...",
  "action": "GRANT",
  "occurred_at": "2026-05-08T10:00:00.000Z"
}
```

Response `200`:

```json
{
  "consentId": "uuid",
  "eventId": "uuid",
  "versionNo": 1,
  "currentStatus": "GRANTED",
  "proofStatus": "PENDING"
}
```

## Error behavior

- invalid token/signature/origin: `400`
- expired session/token: `410`
- already consumed: `409`
- missing session: `404`

## Guarantees preserved

- consent write path still goes through Phase A transaction semantics
- proof remains async via Phase B pipeline
- no webhook/session frontend coupling yet


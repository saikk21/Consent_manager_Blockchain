# Phase C.4 Runtime Contracts

## Hosted widget entry

- `GET /widget/hosted?session_token=<token>`
- Returns Sammati-hosted iframe runtime page
- Validates signed widget session token before rendering

## Runtime bootstrap

- `POST /v1/widget/runtime/bootstrap`
- Auth: session token in body (no API key)

Request:

```json
{
  "session_token": "<jwt>",
  "parent_origin": "https://company.example.com"
}
```

Response:

```json
{
  "version": "1.0",
  "session": {
    "session_id": "uuid",
    "status": "ISSUED",
    "expires_at": "ISO",
    "allowed_origin": "https://company.example.com",
    "locale": "en-IN",
    "purpose_code": "KYC",
    "render_hash": "sha256",
    "state_reason": "optional"
  },
  "policy": {
    "policy_ref": "kyc-consent",
    "policy_version": 1,
    "title": "KYC Consent",
    "required_legal_version": "2026-01",
    "ui_schema_version": 1,
    "sections": [{ "id": "purpose", "text": "..." }]
  }
}
```

## Submission

- Runtime submits via existing endpoint:
  - `POST /v1/widget/sessions/{sessionId}/submit`
- Uses `session_token` auth body + `x-sammati-embed-origin` header
- Session terminal states (`CONSUMED`, `EXPIRED`, `CANCELLED`) block re-submission

## Runtime API examples

Bootstrap:

```bash
curl -X POST "$BASE_URL/v1/widget/runtime/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "<SESSION_TOKEN>",
    "parent_origin": "https://company.example.com"
  }'
```

Submit:

```bash
curl -X POST "$BASE_URL/v1/widget/sessions/$SESSION_ID/submit" \
  -H "Content-Type: application/json" \
  -H "x-sammati-embed-origin: https://company.example.com" \
  -d '{
    "session_token": "<SESSION_TOKEN>",
    "action": "GRANT",
    "occurred_at": "2026-05-07T12:00:00.000Z"
  }'
```

Failure examples:

- Wrong parent origin in bootstrap -> `400`
- Expired session submit -> `410`
- Consumed session replay -> `409`


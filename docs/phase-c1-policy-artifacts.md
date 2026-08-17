# Phase C.1 — Policy artifact system

This document covers the **implemented** Phase C.1 policy artifact subsystem:

- schema and lifecycle (`DRAFT` → `PUBLISHED` → `DEPRECATED`)
- deterministic hashing (`policy_content_hash`, `render_hash`)
- REST APIs (4 endpoints)
- validation rules and immutability guarantees

## Core guarantees

- **Publish is immutable**: after `PUBLISHED` or `DEPRECATED`, content fields cannot be changed (DB trigger enforced).
- **Deterministic hashing**: the same canonical policy payload produces the same `policy_content_hash`.
- **Render hash support**: `render_hash` derived from (`policy_content_hash`, locale, legal version, UI schema version).

## Policy states

| State | Meaning | Mutable? |
|------|---------|----------|
| `DRAFT` | editable draft prior to publish | yes (via new versions; no update API exposed) |
| `PUBLISHED` | immutable, active version | no |
| `DEPRECATED` | immutable, retained for audit | no |

## API contracts

All endpoints require:

```http
Authorization: Bearer <RAW_API_KEY>
```

Write endpoints require:

```http
Idempotency-Key: <unique-key>
```

### 1) Create policy draft

`POST /v1/policies`

Request (example):

```json
{
  "policyRef": "kyc-consent",
  "version": 1,
  "defaultLocale": "en-IN",
  "requiredLegalVersion": "2026-01",
  "uiSchemaVersion": 1,
  "locales": {
    "en-IN": {
      "title": "KYC Consent",
      "sections": [
        { "id": "purpose", "text": "..." },
        { "id": "data_categories", "text": "..." },
        { "id": "processing", "text": "..." },
        { "id": "retention", "text": "..." },
        { "id": "withdrawal", "text": "..." },
        { "id": "grievance", "text": "..." }
      ]
    }
  }
}
```

Response `201`:

```json
{
  "policyRef": "kyc-consent",
  "version": 1,
  "state": "DRAFT",
  "policyContentHash": "hex",
  "createdAt": "ISO"
}
```

### 2) Publish policy version

`POST /v1/policies/{policyRef}/versions/{version}/publish`

Response `200`:

```json
{
  "policyRef": "kyc-consent",
  "version": 1,
  "state": "PUBLISHED",
  "policyContentHash": "hex",
  "publishedAt": "ISO"
}
```

### 3) Get policy version

`GET /v1/policies/{policyRef}/versions/{version}?locale=en-IN`

Response `200` (includes computed `renderHash`):

```json
{
  "policyRef": "kyc-consent",
  "version": 1,
  "state": "PUBLISHED",
  "defaultLocale": "en-IN",
  "requiredLegalVersion": "2026-01",
  "policyContentHash": "hex",
  "uiSchemaVersion": 1,
  "locale": "en-IN",
  "renderHash": "hex",
  "locales": { "...": "..." },
  "publishedAt": "ISO",
  "createdAt": "ISO"
}
```

### 4) List policy versions (paginated)

`GET /v1/policies/{policyRef}/versions?cursor=0&limit=20`

Response `200`:

```json
{
  "policyRef": "kyc-consent",
  "items": [
    { "version": 1, "state": "PUBLISHED", "policyContentHash": "hex", "publishedAt": "ISO", "createdAt": "ISO" }
  ],
  "page": { "limit": 20, "nextCursor": null, "hasMore": false }
}
```

## Validation rules

- `defaultLocale` must exist in `locales`
- each locale must include required section ids:
  - `purpose`, `data_categories`, `processing`, `retention`, `withdrawal`, `grievance`
- publish recomputes `policy_content_hash` and must match stored value (determinism check)

## Storage

- table: `policy_artifacts`
- unique: `(company_id, policy_ref, version)`
- indexes:
  - `(company_id, policy_ref)`
  - `(company_id, state, created_at)`


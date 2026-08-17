# Phase C.1 — Manual validation checklist (policy artifacts)

This checklist validates policy lifecycle, hashing determinism, publish immutability, and pagination.

## Setup

```cmd
set "BASE=http://localhost:3001"
set "API_KEY=<RAW_API_KEY>"
```

## 1) Create draft (valid)

```cmd
curl -X POST "%BASE%/v1/policies" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %API_KEY%" ^
  -H "Idempotency-Key: pol-draft-1" ^
  -d "{\"policyRef\":\"kyc-consent\",\"version\":1,\"defaultLocale\":\"en-IN\",\"requiredLegalVersion\":\"2026-01\",\"uiSchemaVersion\":1,\"locales\":{\"en-IN\":{\"title\":\"KYC Consent\",\"sections\":[{\"id\":\"purpose\",\"text\":\"p\"},{\"id\":\"data_categories\",\"text\":\"d\"},{\"id\":\"processing\",\"text\":\"pr\"},{\"id\":\"retention\",\"text\":\"r\"},{\"id\":\"withdrawal\",\"text\":\"w\"},{\"id\":\"grievance\",\"text\":\"g\"}]}}}"
```

Expected: `201` with `state=DRAFT` and a `policyContentHash`.

## 2) Publish version

```cmd
curl -X POST "%BASE%/v1/policies/kyc-consent/versions/1/publish" ^
  -H "Authorization: Bearer %API_KEY%" ^
  -H "Idempotency-Key: pol-pub-1"
```

Expected: `200` with `state=PUBLISHED`.

## 3) Fetch version and render hash

```cmd
curl "%BASE%/v1/policies/kyc-consent/versions/1?locale=en-IN" ^
  -H "Authorization: Bearer %API_KEY%"
```

Expected: `200` with `renderHash` present.

## 4) List versions (pagination)

```cmd
curl "%BASE%/v1/policies/kyc-consent/versions?cursor=0&limit=10" ^
  -H "Authorization: Bearer %API_KEY%"
```

Expected: includes version 1.

## 5) Required section validation (negative)

Remove one required section id (e.g. `grievance`) and retry draft create.

Expected: `400`.

## 6) Immutability (DB-level)

Immutability is enforced by DB trigger on `policy_artifacts` for non-DRAFT states.
Validate via the DB-backed test:

```cmd
set "DATABASE_URL=postgres://postgres:cyberrange%401423@localhost:5432/sammati_ledger"
npm run test:policy-artifacts
```

Expected: `policy artifacts tests passed`.


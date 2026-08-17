# Quickstart — local run

End-to-end copy-paste for **Phase A** (API + ledger). **Phase B** workers are optional; see [§ Optional Phase B workers](#optional-phase-b-workers).

**Base URL:** use `http://localhost:3000` unless you set `PORT` (e.g. `PORT=3001`).

---

## 1) Database connection

Open **CMD** in the project root:

```cmd
cd /d "C:\Users\hp\Desktop\Sammati Project\Project Sammati"
set "DATABASE_URL=postgres://postgres:cyberrange%401423@localhost:5432/sammati_ledger"
```

Create DB if missing:

```cmd
set "PG_BIN=C:\Program Files\PostgreSQL\17\bin"
set "PGPASSWORD=your_password_here"
"%PG_BIN%\createdb.exe" -h localhost -p 5432 -U postgres sammati_ledger
```

---

## 2) Install and migrate

```cmd
npm install
npm run migrate:up
```

---

## 3) Bootstrap company and first API key

```cmd
npm run company:bootstrap -- "Demo Company"
```

Save `rawApiKey` from the JSON output; it is shown once.

---

## 4) Start API

```cmd
npm run dev
```

Default: `http://localhost:3000`. Set `PORT` to change.

---

## 5) Test grant (second terminal)

Replace `<RAW_API_KEY>` and adjust host/port if needed:

```cmd
set "BASE=http://localhost:3000"
curl -X POST "%BASE%/v1/consents/grant" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <RAW_API_KEY>" ^
  -H "Idempotency-Key: quickstart-grant-1" ^
  -d "{\"external_user_id\":\"ext-user-1\",\"purpose_code\":\"KYC\",\"policy_ref\":\"policy-v1\",\"occurred_at\":\"2026-05-06T10:00:00.000Z\"}"
```

---

## 6) Status and timeline

```cmd
curl "%BASE%/v1/consents/status?external_user_id=ext-user-1&purpose_code=KYC" ^
  -H "Authorization: Bearer <RAW_API_KEY>"

curl "%BASE%/v1/consents/timeline?external_user_id=ext-user-1&purpose_code=KYC&cursor=0&limit=10" ^
  -H "Authorization: Bearer <RAW_API_KEY>"
```

---

## 7) Lifecycle script

```cmd
npm run test:lifecycle -- <RAW_API_KEY>
```

Set `API_BASE_URL` if not using `http://localhost:3000`.

---

## 8) Idempotency

- **Replay:** same `Idempotency-Key` + same body → same response.
- **Conflict:** same key + different body → `409`.

---

## 9) Docker (optional)

```cmd
docker compose up --build
```

---

## Optional — Phase B workers

Same `DATABASE_URL` as the API. After writes, events stay `proofStatus: PENDING` until the proof worker runs.

**Terminal A — API:** `npm run dev`  
**Terminal B — proof worker:** `npm run worker:proof`  
**Terminal C — mock anchor:** `npm run worker:anchor-mock`

Then use proof APIs (see [`phase-b-api-contracts.md`](phase-b-api-contracts.md)):

- `GET /v1/proofs/events/:eventId`
- `GET /v1/proofs/consents/:consentId?cursor=&limit=`
- `GET /v1/proofs/batches/:batchId`
- `POST /v1/proofs/verify`

Runtime validation summary: [`phase-b-runtime-validation.md`](phase-b-runtime-validation.md).

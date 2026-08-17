# Phase C.2 — Manual validation checklist

## Setup

```cmd
set "BASE=http://localhost:3001"
set "API_KEY=<RAW_API_KEY>"
set "DATABASE_URL=postgres://postgres:cyberrange%401423@localhost:5432/sammati_ledger"
```

## 1) Create session

```cmd
curl -X POST "%BASE%/v1/widget/sessions" ^
  -H "Authorization: Bearer %API_KEY%" ^
  -H "Idempotency-Key: ws-create-1" ^
  -H "Content-Type: application/json" ^
  -d "{\"external_user_id\":\"ext-ws-1\",\"purpose_code\":\"KYC\",\"policy_ref\":\"kyc-consent\",\"policy_version\":1,\"locale\":\"en-IN\",\"allowed_origin\":\"https://app.example.com\",\"environment\":\"dev\",\"ttl_seconds\":600}"
```

Expected: `201` with `sessionId`, `sessionToken`, `renderHash`.

## 2) Get session

```cmd
curl "%BASE%/v1/widget/sessions/<sessionId>" -H "Authorization: Bearer %API_KEY%"
```

Expected: `status=ISSUED`.

## 3) Submit with valid origin/token

```cmd
curl -X POST "%BASE%/v1/widget/sessions/<sessionId>/submit" ^
  -H "Origin: https://app.example.com" ^
  -H "Content-Type: application/json" ^
  -d "{\"session_token\":\"<sessionToken>\",\"action\":\"GRANT\",\"occurred_at\":\"2026-05-08T10:00:00.000Z\"}"
```

Expected: `200`, consent result payload.

## 4) Replay submit (single-use)

Run step 3 again with same token/session.

Expected: `409` (`already consumed`).

## 5) Invalid origin check

Submit with:

`Origin: https://evil.example.com`

Expected: `400`.

## 6) Expiry check

Create session with `ttl_seconds=1`, wait ~2 seconds, submit.

Expected: `410`.

## 7) DB lifecycle verification

```cmd
"%PG_BIN%\psql.exe" "%DATABASE_URL%" -c "select id,status,issued_at,started_at,consumed_at,expires_at,cancelled_at,consent_event_id from widget_sessions order by created_at desc limit 10;"
```

Expected:

- successful flow reaches `CONSUMED`
- replay remains `CONSUMED`
- expired flow reaches `EXPIRED`

## 8) Automated tests

```cmd
npm run test:widget-token
npm run test:widget-sessions
```

Expected:

- `widget session token tests passed`
- `widget sessions tests passed`


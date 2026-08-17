# Phase C.3 Webhook API Contracts

## Scope

Webhook management and delivery infrastructure only.

Supported event types:

- `consent.recorded`
- `proof.ready`
- `proof.anchor_confirmed`
- `widget.session.created`
- `widget.session.consumed`

## Create Endpoint

`POST /v1/webhooks/endpoints`

Headers:

- `Authorization: Bearer <API_KEY>`
- `Idempotency-Key: <key>`

Body:

```json
{
  "url": "https://example.com/webhooks/sammati",
  "events": ["consent.recorded", "proof.ready"],
  "environment": "dev"
}
```

Response `201`:

```json
{
  "endpointId": "uuid",
  "url": "https://example.com/webhooks/sammati",
  "events": ["consent.recorded", "proof.ready"],
  "environment": "dev",
  "status": "ACTIVE",
  "signingSecret": "whsec_...",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```

## List Endpoints

`GET /v1/webhooks/endpoints?cursor=0&limit=20`

Response `200` returns endpoint list and pagination cursor.

## Update Endpoint

`PATCH /v1/webhooks/endpoints/{endpointId}`

Body (partial):

```json
{
  "url": "https://example.com/new-path",
  "events": ["consent.recorded"],
  "status": "PAUSED"
}
```

## Rotate Secret

`POST /v1/webhooks/endpoints/{endpointId}/rotate-secret`

Headers:

- `Authorization: Bearer <API_KEY>`
- `Idempotency-Key: <key>`

Response `200` returns new one-time `signingSecret`.

## Send Test Event

`POST /v1/webhooks/endpoints/{endpointId}/test`

Headers:

- `Authorization: Bearer <API_KEY>`
- `Idempotency-Key: <key>`

Response `200`:

```json
{
  "endpointId": "uuid",
  "result": "QUEUED"
}
```

## Curl examples

```bash
curl -X POST "$BASE_URL/v1/webhooks/endpoints" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://127.0.0.1:4010/success",
    "events": ["consent.recorded","proof.ready"],
    "environment": "dev"
  }'
```

```bash
curl "$BASE_URL/v1/webhooks/endpoints?cursor=0&limit=20" \
  -H "Authorization: Bearer $API_KEY"
```

```bash
curl -X PATCH "$BASE_URL/v1/webhooks/endpoints/$ENDPOINT_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://127.0.0.1:4010/fail500","events":["consent.recorded"],"status":"ACTIVE"}'
```

```bash
curl -X POST "$BASE_URL/v1/webhooks/endpoints/$ENDPOINT_ID/rotate-secret" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```bash
curl -X POST "$BASE_URL/v1/webhooks/endpoints/$ENDPOINT_ID/test" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Expected delivery headers

- `x-sammati-signature`
- `x-sammati-timestamp`
- `x-sammati-delivery-id`
- `x-sammati-event-id`
- `x-sammati-event-type`


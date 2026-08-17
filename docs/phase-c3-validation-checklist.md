# Phase C.3 Validation Checklist

## Runtime setup

1. `npm run migrate:up`
2. `npm run dev`
3. `npm run worker:webhook`
4. Start local receiver:

```bash
node -e "const http=require('http');const fs=require('fs');http.createServer((req,res)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{fs.appendFileSync('webhook-receiver-log.jsonl',JSON.stringify({url:req.url,headers:req.headers,body:b,time:new Date().toISOString()})+'\n');if(req.url==='/fail500'){res.statusCode=500;return res.end('retry');}if(req.url==='/fail400'){res.statusCode=400;return res.end('dead');}res.statusCode=200;res.end('ok');});}).listen(4010)"
```

## Compact freeze runbook

Set:

- `BASE_URL=http://127.0.0.1:3000`
- `API_KEY=<raw_api_key_from_bootstrap>`
- `ENDPOINT_ID=<created_endpoint_id>`

Run:

1. Create endpoint (`/success` URL)
2. List endpoint
3. Update endpoint (`/fail500` URL)
4. Rotate secret
5. Send test event
6. Observe retries in `webhook_deliveries`
7. Update endpoint (`/fail400` URL), send test event, confirm `DEAD_LETTER`
8. Update endpoint (`/success` URL), send test event, confirm `DELIVERED`
9. Start second `worker:webhook`, send test event, confirm single successful request for new delivery id
10. Run `npm run test:webhooks`

## Endpoint management

- Create webhook endpoint via `POST /v1/webhooks/endpoints`
- List with pagination via `GET /v1/webhooks/endpoints`
- Patch status/events via `PATCH /v1/webhooks/endpoints/{id}`
- Rotate secret via `POST /v1/webhooks/endpoints/{id}/rotate-secret`
- Queue test delivery via `POST /v1/webhooks/endpoints/{id}/test`

## Delivery lifecycle checks

- Success path: receiver returns 200 -> status becomes `DELIVERED`
- Retry path: receiver returns 500 -> row requeued with incremented `attempt_count`
- Dead-letter path: receiver returns 400 (or attempts exhausted) -> status `DEAD_LETTER`
- Concurrency path: run multiple workers -> no duplicate delivery claims
- Persistence check:
  - `attempt_count`, `last_http_status`, `last_error`, `delivered_at`, `dead_lettered_at` are populated correctly
- Duplicate protection:
  - `(endpoint_id, event_id)` unique constraint prevents duplicate rows

## Security checks

- Verify signature using `docs/phase-c3-signature-spec.md`
- Reject stale timestamp outside tolerance
- Verify canonical payload hash consistency
- Verify old secret/new secret behavior after rotation
- Reject invalid signature (tampered body or wrong secret)

## Automated tests

- `npm run test:webhooks`
- Coverage: signature pass/fail, replay window, retries, dead-letter, duplicate protection, worker concurrency


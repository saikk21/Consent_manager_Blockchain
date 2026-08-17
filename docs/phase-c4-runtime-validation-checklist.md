# Phase C.4 Runtime Validation Checklist

## Runtime flow

1. Create widget session via `POST /v1/widget/sessions`
2. Embed `GET /widget/hosted?session_token=...` in iframe
3. Observe postMessage sequence:
   - `widget.ready`
   - `widget.loaded`
   - `widget.resized`
4. Submit action (`GRANT`/`UPDATE`/`REVOKE`) from runtime UI
5. Observe:
   - Success: `consent.submitted`
   - Failure: `consent.failed` or `widget.error`

## Security checks

- Wrong parent origin -> bootstrap rejected
- Expired session -> bootstrap returns terminal expired state
- Consumed session -> actions disabled, terminal state shown
- CSP header includes `frame-ancestors <allowed_origin>`
- Rendered section ordering is deterministic

## Tests

- `npm run test:widget-runtime`


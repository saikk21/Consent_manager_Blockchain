# Phase C.4 postMessage Schema (v1.0)

All runtime events sent from iframe to parent:

```json
{
  "version": "1.0",
  "event": "widget.ready | widget.loaded | widget.resized | consent.submitted | consent.failed | widget.error",
  "payload": {}
}
```

## Events

- `widget.ready`
  - payload: `{ "state": "bootstrapping" }`
- `widget.loaded`
  - payload: `{ "session_id": "...", "status": "ISSUED|...", "locale": "...", "render_hash": "..." }`
- `widget.resized`
  - payload: `{ "height": number }`
- `consent.submitted`
  - payload: consent submit API success payload
- `consent.failed`
  - payload: `{ "message": "..." }`
- `widget.error`
  - payload: `{ "code": "BOOTSTRAP_FAILED", "message": "..." }`


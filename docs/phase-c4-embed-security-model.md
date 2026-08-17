# Phase C.4 Embed Security Model

## Trust boundaries

- **Sammati widget runtime**: renders legal content and action controls.
- **Company app (parent frame)**: embeds iframe, receives runtime events.
- **No legal text injection from company frontend**: policy content is fetched and rendered from published policy artifact only.

## Controls

- Signed session token verification (`HS256`, `kid` aware)
- Parent-origin check against `allowed_origin` claim during runtime bootstrap
- Session replay safeguards (`nonce`, terminal state checks)
- Render integrity check (`render_hash` claim and DB value validation)
- CSP on hosted page with dynamic `frame-ancestors <allowed_origin>`

## Known non-goals in C.4

- SDK wrappers (deferred)
- Admin dashboard runtime
- Blockchain/runtime integrations


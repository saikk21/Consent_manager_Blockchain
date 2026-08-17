# Sammati Ledger — Platform Architecture & API Reference Handbook

| Field | Value |
|--------|--------|
| **Document** | HANDBOOK-PLATFORM-ARCHITECTURE-AND-API |
| **Repository** | `sammati-ledger` (monorepo root + `packages/*`) |
| **Service name** | Sammati consent ledger API (Fastify + PostgreSQL) |
| **Related handbooks** | [Company onboarding](./HANDBOOK-COMPANY-ONBOARDING.md) · [DB schema](./HANDBOOK-DB-SCHEMA-AND-MIGRATIONS.md) · [Blockchain integration](./HANDBOOK-BLOCKCHAIN-INTEGRATION.md) |

---

## Table of contents

1. [Executive summary](#1-executive-summary)  
2. [Repository layout](#2-repository-layout)  
3. [Technology stack](#3-technology-stack)  
4. [Configuration & environment](#4-configuration--environment)  
5. [Process model](#5-process-model)  
6. [HTTP server behavior](#6-http-server-behavior)  
7. [Authentication & authorization](#7-authentication--authorization)  
8. [Idempotency](#8-idempotency)  
9. [Complete HTTP API reference](#9-complete-http-api-reference)  
10. [Consent domain (summary)](#10-consent-domain-summary)  
11. [Policy artifacts (summary)](#11-policy-artifacts-summary)  
12. [Widget sessions & runtime](#12-widget-sessions--runtime)  
13. [Proof pipeline & read APIs](#13-proof-pipeline--read-apis)  
14. [Webhooks](#14-webhooks)  
15. [Error handling (widget routes)](#15-error-handling-widget-routes)  
16. [NPM scripts reference](#16-npm-scripts-reference)  
17. [Workspace packages (`@sammati/*`)](#17-workspace-packages-sammati)  
18. [Key source files](#18-key-source-files)  
19. [Further reading (phase docs)](#19-further-reading-phase-docs)  
20. [Document control](#20-document-control)  

---

## 1. Executive summary

Sammati is a **multi-tenant consent ledger**: companies authenticate with **API keys**, publish **policy artifacts**, record **consent events** (with idempotency), expose a **hosted iframe widget** for user-driven consent, enqueue **proof** work via an **outbox**, and optionally deliver **webhooks**.

This handbook is the **single consolidated reference** for architecture and HTTP APIs. Deeper narrative for widget security lives in **`docs/internal-p0-ledger-architecture-and-integration.md`**.

---

## 2. Repository layout

| Path | Purpose |
|------|---------|
| `src/server.ts` | Fastify app composition, route registration, `listen` when executed directly |
| `src/api/http/routes/` | HTTP route modules (`consents`, `proofs`, `policies`, `widgetSessions`, `widgetRuntime`, `webhooks`) |
| `src/api/http/handlers/` | Consent write/read, proof read handlers |
| `src/api/http/middleware/` | `authApiKeyPlugin` (Bearer → `req.companyId`) |
| `src/api/http/widgetRouteErrors.ts` | Maps widget service errors → HTTP status (substring rules) |
| `src/services/` | Application services (consent lifecycle, policy, widget, proof, webhooks) |
| `src/domain/` | Pure domain rules (consent lifecycle, policy validation/hashing/ordering) |
| `src/persistence/` | DB pool, migrations, repositories |
| `src/security/` | API key hashing, widget session JWS |
| `src/scripts/` | CLI utilities (`company:bootstrap`, workers, etc.) |
| `packages/shared-core` | Shared types, errors, transport, **widget protocol** (`widgetProtocol.ts`) |
| `packages/widget-sdk` | Browser helpers (iframe URL, postMessage listener) |
| `packages/server-sdk` | Typed HTTP client for integrators |
| `packages/webhook-utils` | Webhook signature helpers |
| `scripts/integration-prep/` | **Non-runtime** operator examples (curl, JSON, validators) |

---

## 3. Technology stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM) |
| HTTP | Fastify 5 |
| Validation | Zod |
| Database | PostgreSQL via `pg` |
| Migrations | node-pg-migrate (`src/persistence/migrations/*.cjs`) |
| Security headers | `@fastify/helmet` (select routes disable Helmet — see widget section) |
| Errors | `@fastify/sensible` (`httpErrors`) |
| Rate limit | `@fastify/rate-limit` (300 requests / minute per IP default) |

---

## 4. Configuration & environment

Validated in **`src/config/env.ts`**:

| Variable | Required | Default / notes |
|----------|----------|-----------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `PORT` | No | `3000` |
| `API_KEY_HASH_PEPPER` | No | Empty string allowed (set in prod) |
| `WIDGET_SESSION_SIGNING_KID` | No | `wsk-dev-1` |
| `WIDGET_SESSION_SIGNING_KEY` | No | dev default — **override in prod** |
| `WIDGET_SESSION_SIGNING_KEYS_JSON` | No | Optional JSON map `{ "kid": "secret", ... }` for rotation; first entry used to sign |

Load order: `dotenv/config` in `env.ts`; migrations and server use `--env-file=.env` where applicable (see `package.json` scripts).

---

## 5. Process model

| Process | Entry | Role |
|---------|-------|------|
| API | `npm run dev` / `npm run start` | HTTP + synchronous consent/policy/widget |
| Proof worker | `npm run worker:proof` | Merkle batching from outbox |
| Anchor mock | `npm run worker:anchor-mock` | Simulated anchoring |
| Webhook worker | `npm run worker:webhook` | Delivers signed webhook HTTP |

---

## 6. HTTP server behavior

- **Request ID:** header `x-request-id`; generated UUID if absent.  
- **Logger redaction:** `authorization`, `idempotency-key`, `req.body.external_user_id` paths redacted.  
- **Global plugins:** `helmet`, `sensible`, `rateLimit` (300/min).  
- **Decorators:** `app.pool`, `app.services` (see `src/server.ts`).

---

## 7. Authentication & authorization

| Mode | Routes |
|------|--------|
| **No API key** (`skipApiKeyAuth: true`) | `GET /healthz`, `GET /v1/_meta`, `GET /widget/hosted`, `POST /v1/widget/runtime/bootstrap`, `POST /v1/widget/sessions/:sessionId/submit` |
| **Bearer API key** | All other `/v1/*` routes |

Plugin: `src/api/http/middleware/authApiKey.ts` — parses `Authorization: Bearer <token>`, hashes with `API_KEY_HASH_PEPPER`, resolves `company_id`, sets `req.companyId`.

---

## 8. Idempotency

**Header:** `Idempotency-Key: <non-empty string>`

**Required on:**

- `POST /v1/consents/grant`, `/update`, `/revoke`  
- `POST /v1/policies`, `POST /v1/policies/:policyRef/versions/:version/publish`  
- `POST /v1/widget/sessions`  
- `POST /v1/webhooks/endpoints`, `.../rotate-secret`, `.../test`  

Implementation: `idempotency_keys` table + consent write logic in `ConsentLifecycleService`.

---

## 9. Complete HTTP API reference

Legend: **Auth** — `none` | `bearer`. **Idem** — idempotency header required.

### 9.1 System

| Method | Path | Auth | Idem | Description |
|--------|------|------|------|-------------|
| `GET` | `/healthz` | none | — | Liveness `{ ok: true }` |
| `GET` | `/v1/_meta` | none | — | Service metadata (`service`, `phase`, `now`, `auth` hint) |

### 9.2 Consents (API key)

| Method | Path | Auth | Idem | Body / query | Success |
|--------|------|------|------|----------------|---------|
| `POST` | `/v1/consents/grant` | bearer | **yes** | JSON: `external_user_id`, `purpose_code`, `policy_ref`, `occurred_at` (ISO datetime) | `200` + `{ consentId, eventId, versionNo, currentStatus, proofStatus: "PENDING" }` |
| `POST` | `/v1/consents/update` | bearer | **yes** | Same body shape | `200` + same result shape |
| `POST` | `/v1/consents/revoke` | bearer | **yes** | Same body shape | `200` + same result shape |
| `GET` | `/v1/consents/status` | bearer | — | Query: `external_user_id`, `purpose_code` | `200` status object; `404` if consent missing |
| `GET` | `/v1/consents/timeline` | bearer | — | Query: `external_user_id`, `purpose_code`, optional `cursor`, `limit` | `200` paginated timeline; `404` if missing |

**Domain errors → HTTP:** `CONSENT_NOT_FOUND` → 404; `INVALID_TRANSITION` → 400; `VALIDATION_ERROR` → 409; default → 400 (`src/api/http/handlers/consentWrite.ts`).

### 9.3 Proofs (API key)

| Method | Path | Auth | Idem | Input | Success |
|--------|------|------|------|-------|---------|
| `GET` | `/v1/proofs/events/:eventId` | bearer | — | Path `eventId` UUID | `200` proof payload; `404` not found |
| `GET` | `/v1/proofs/consents/:consentId` | bearer | — | Path `consentId`; query `cursor`, `limit` | `200` list page; `404` |
| `GET` | `/v1/proofs/batches/:batchId` | bearer | — | Path `batchId` UUID | `200` batch; `404` |
| `POST` | `/v1/proofs/verify` | bearer | — | JSON: `leaf_hash`, `path_hashes[]`, `path_positions[]` (`"L"`\|`"R"`), `root_hash` | `200` `{ valid: boolean }` |

### 9.4 Policies (API key)

| Method | Path | Auth | Idem | Body / query | Success |
|--------|------|------|------|----------------|---------|
| `POST` | `/v1/policies` | bearer | **yes** | Policy draft JSON (see `CreatePolicyDraftSchema` in `src/domain/policy/validation.ts`) | `201` draft summary |
| `POST` | `/v1/policies/:policyRef/versions/:version/publish` | bearer | **yes** | Body `{}` | `200` published summary; `404` if draft missing |
| `GET` | `/v1/policies/:policyRef/versions/:version` | bearer | — | Optional `?locale=` | `200` full version; `404` |
| `GET` | `/v1/policies/:policyRef/versions` | bearer | — | Query `cursor`, `limit` | `200` version list page |

### 9.5 Widget sessions (API key + public submit)

| Method | Path | Auth | Idem | Body / headers | Success |
|--------|------|------|------|----------------|---------|
| `POST` | `/v1/widget/sessions` | bearer | **yes** | JSON: `external_user_id`, `purpose_code`, `policy_ref`, `policy_version` (int), `locale`, `allowed_origin` (URL), optional `environment`, `ttl_seconds` (≤3600, default 600) | `201` `{ sessionId, expiresAt, render: { renderHash, uiSchemaVersion }, token: { sessionToken } }` |
| `GET` | `/v1/widget/sessions/:sessionId` | bearer | — | — | `200` session summary; `404` |
| `POST` | `/v1/widget/sessions/:sessionId/submit` | **none** | — | JSON: `session_token`, `action` (`GRANT`\|`UPDATE`\|`REVOKE`), `occurred_at`. Headers: prefer `x-sammati-embed-origin: <allowed_origin>` else `Origin` must equal token `allowed_origin` | `200` same shape as consent record result |

### 9.6 Widget runtime (public)

| Method | Path | Auth | Idem | Input | Success |
|--------|------|------|------|-------|---------|
| `GET` | `/widget/hosted` | none | — | Query `session_token` (min 20 chars). **Helmet disabled.** Sets `Content-Security-Policy` including `frame-ancestors <allowed_origin from token>` | `200` `text/html` document |
| `POST` | `/v1/widget/runtime/bootstrap` | none | — | JSON: `session_token`, optional `parent_origin` (must match `allowed_origin` if sent). **Helmet disabled.** | `200` bootstrap JSON (`version` = `WIDGET_MESSAGE_VERSION`); errors mapped per §15 |

### 9.7 Webhooks (API key)

| Method | Path | Auth | Idem | Notes |
|--------|------|------|------|-------|
| `POST` | `/v1/webhooks/endpoints` | bearer | **yes** | Body: `url`, `events[]` (from `WebhookEventTypes`), optional `environment` |
| `GET` | `/v1/webhooks/endpoints` | bearer | — | Query `cursor`, `limit` |
| `PATCH` | `/v1/webhooks/endpoints/:endpointId` | bearer | — | Partial update (`url`, `events`, `status`) |
| `POST` | `/v1/webhooks/endpoints/:endpointId/rotate-secret` | bearer | **yes** | — |
| `POST` | `/v1/webhooks/endpoints/:endpointId/test` | bearer | **yes** | Enqueues test payload |

Webhook event types (`src/services/webhooks/webhookTypes.ts`): `consent.recorded`, `proof.ready`, `proof.anchor_confirmed`, `widget.session.created`, `widget.session.consumed`.

---

## 10. Consent domain (summary)

- Identity: `(company_id, external_user_id, purpose_code)`.  
- Actions: `GRANT`, `UPDATE`, `REVOKE` map to event types via `src/domain/consent/lifecycle.ts`.  
- Each successful write creates **`events`** + **`consent_versions`**, updates **`consents`**, finalizes idempotency, enqueues **`outbox`** `proof.pending`, may enqueue **`consent.recorded`** webhook.

---

## 11. Policy artifacts (summary)

- Stored in **`policy_artifacts`** with `policy_ref` + `version` uniqueness per company.  
- **DRAFT → PUBLISHED** transition; **immutability** trigger after publish.  
- **Content hash** stable JSON canonicalization: `computePolicyContentHash` (`src/domain/policy/hashing.ts`).  
- **Widget binding:** `computeRenderHash` over `(policyContentHash, locale, requiredLegalVersion, uiSchemaVersion)` stored on session + token.

---

## 12. Widget sessions & runtime

- **Session token:** HS256 JWS (`src/security/widgetSessionToken.ts`); claims bind policy version, locale, `allowed_origin`, `render_hash`, `nonce`.  
- **Hosted page:** `src/services/widget/hostedWidgetHtml.ts` (inline script uses `@sammati/shared-core` `WIDGET_MESSAGE_VERSION` + `WIDGET_EVENTS`).  
- **Bootstrap:** `WidgetRuntimeService.bootstrap` — may mark session `EXPIRED` inside transaction; allows expired token decode for UX on hosted GET only.  
- **Section order:** `orderPolicySectionsForWidgetRuntime` in `src/domain/policy/widgetSectionOrder.ts`.

**postMessage envelope:** `{ version, event, payload }` — see `packages/shared-core/src/widgetProtocol.ts` and `docs/phase-c4-postmessage-spec.md`.

---

## 13. Proof pipeline & read APIs

1. Consent write enqueues outbox `proof.pending`.  
2. `ProofWorkerService` batches events → Merkle tree → persists `proof_batches`, paths, updates `events`.  
3. Read APIs expose per-event proof, per-consent proof list, batch metadata.  
4. `POST /v1/proofs/verify` recomputes Merkle inclusion locally (`{ valid: boolean }`).

---

## 14. Webhooks

- Management via §9.7.  
- Delivery worker polls `webhook_deliveries` with backoff (see `webhookDeliveryWorkerService.ts`).  
- Signing: `signature_algorithm` default `HMAC_SHA256_V1` — details in phase-c3 docs.

---

## 15. Error handling (widget routes)

Centralized in **`src/api/http/widgetRouteErrors.ts`** (substring matching on `Error.message`):

| Flow | `expired` | `consumed` / `cancelled` / `already consumed` | `not found` | else |
|------|-----------|-----------------------------------------------|-------------|------|
| Bootstrap | **410** Gone | **409** Conflict | — | **400** Bad Request |
| Submit | **410** Gone | **409** Conflict | **404** Not Found | **400** |
| Session create | — | — | — | **400** (always from catch) |

**Do not rely on message text for client logic** — prefer HTTP status; messages can evolve.

---

## 16. NPM scripts reference

| Script | Purpose |
|--------|---------|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` | Compile ledger to `dist/` |
| `npm run start` | `node dist/server.js` |
| `npm run migrate:up` / `migrate:down` | DB migrations |
| `npm run company:bootstrap` | Create company + API key |
| `npm run apikey:create` | Additional API key helper |
| `npm run worker:proof` | Proof worker |
| `npm run worker:anchor-mock` | Mock anchor worker |
| `npm run worker:webhook` | Webhook delivery worker |
| `npm run build:packages` | Build all workspace packages |
| `npm run test:packages` | Vitest in workspaces |
| `npm run verify:freeze-local` | Ledger compile + fast widget/protocol checks |
| `npm run test:widget-runtime` | DB integration (needs `DATABASE_URL`) |
| `npm run test:widget-sessions`, `test:policy-artifacts`, `test:webhooks`, … | Other DB tests |
| `npm run verify:sample-policy-json` | Validates sample policy JSON in `scripts/integration-prep` |
| `npm run ci:verify-sdk` | Workspace dependency + typecheck + release dry-run + smoke |

---

## 17. Workspace packages (`@sammati/*`)

| Package | Role |
|---------|------|
| `@sammati/shared-core` | Errors, transport, **widget protocol constants** (`WIDGET_MESSAGE_VERSION`, `WIDGET_EVENTS`, …) |
| `@sammati/widget-sdk` | Browser iframe + postMessage helpers |
| `@sammati/server-sdk` | Typed HTTP client |
| `@sammati/webhook-utils` | Signature verification helpers for receivers |

Root **`package.json`** depends on `@sammati/shared-core` for ledger widget modules.

---

## 18. Key source files

| Concern | Path |
|---------|------|
| Server bootstrap | `src/server.ts` |
| Env schema | `src/config/env.ts` |
| Consent write | `src/api/http/handlers/consentWrite.ts`, `src/services/consentLifecycle/consentLifecycleService.ts` |
| Policy | `src/services/policy/policyService.ts`, `src/domain/policy/*` |
| Widget | `src/api/http/routes/widgetSessions.ts`, `widgetRuntime.ts`, `src/services/widget/*`, `src/security/widgetSessionToken.ts` |
| Proof | `src/services/proof/*`, `src/api/http/handlers/proofRead.ts` |
| Webhooks | `src/services/webhooks/*`, `src/api/http/routes/webhooks.ts` |
| Migrations | `src/persistence/migrations/*.cjs` |

---

## 19. Further reading (phase docs)

| Topic | Document |
|-------|----------|
| Phase A/B API tables | `docs/phase-a-api-contracts.md`, `docs/phase-b-api-contracts.md` |
| Policy artifacts detail | `docs/phase-c1-policy-artifacts.md` |
| Widget session contracts | `docs/phase-c2-widget-session-contracts.md` |
| Webhooks | `docs/phase-c3-webhooks-api-contracts.md` |
| Iframe, postMessage, runtime JSON | `docs/phase-c4-iframe-integration-guide.md`, `phase-c4-postmessage-spec.md`, `phase-c4-runtime-contracts.md`, `phase-c4-embed-security-model.md` |
| Widget SDK | `docs/phase-d1d-widget-sdk.md` |
| Server SDK | `docs/phase-d1c-server-sdk.md` |
| Narrative integration map | `docs/internal-p0-ledger-architecture-and-integration.md` |
| Local quickstart (copy-paste) | `docs/quickstart.md` |

---

## 20. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-05-12 | Initial consolidated handbook pack |

When APIs change, update **§9** and bump version.

---

*End of Platform Architecture & API Reference Handbook.*

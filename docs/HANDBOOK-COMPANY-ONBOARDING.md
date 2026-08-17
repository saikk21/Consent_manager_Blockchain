# Sammati Ledger — Company Integration & Onboarding Handbook

| Field | Value |
|--------|--------|
| **Document** | HANDBOOK-COMPANY-ONBOARDING |
| **Audience** | Engineering teams integrating a company website or backend with Sammati |
| **Companion docs** | [Platform & API](./HANDBOOK-PLATFORM-ARCHITECTURE-AND-API.md) · [DB](./HANDBOOK-DB-SCHEMA-AND-MIGRATIONS.md) · [internal-p0](./internal-p0-ledger-architecture-and-integration.md) |

---

## Table of contents

1. [What you are integrating](#1-what-you-are-integrating)  
2. [Prerequisites](#2-prerequisites)  
3. [Start the platform (local)](#3-start-the-platform-local)  
4. [Obtain an API key](#4-obtain-an-api-key)  
5. [Typical integration sequence](#5-typical-integration-sequence)  
6. [Hosted widget (iframe) checklist](#6-hosted-widget-iframe-checklist)  
7. [Webhooks (optional)](#7-webhooks-optional)  
8. [Workers (optional, same machine)](#8-workers-optional-same-machine)  
9. [Verification commands](#9-verification-commands)  
10. [Production checklist](#10-production-checklist)  
11. [Sample payloads & curl](#11-sample-payloads--curl)  

---

## 1. What you are integrating

Sammati provides:

- **Policy artifacts** (draft → publish) per company.  
- **Consent ledger** (grant / update / revoke) with idempotency and proof pipeline.  
- **Hosted consent widget** (iframe) with session tokens and postMessage events.  
- **Webhooks** for async notifications (`consent.recorded`, `proof.ready`, etc.).  

Your **CMS or company app** holds user identity and UX; Sammati holds **consent evidence** and **policy versions** bound to sessions.

---

## 2. Prerequisites

- **Node.js** (LTS recommended) and **npm**.  
- **PostgreSQL** reachable from your machine.  
- **Git** clone of this repository.  
- Environment file **`.env`** at repo root (see §3).

---

## 3. Start the platform (local)

### 3.1 Environment

Create `.env` in the project root (minimum):

```env
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE_NAME
PORT=3000
API_KEY_HASH_PEPPER=your-long-random-pepper
WIDGET_SESSION_SIGNING_KID=wsk-dev-1
WIDGET_SESSION_SIGNING_KEY=your-long-random-widget-signing-secret
```

Optional: `WIDGET_SESSION_SIGNING_KEYS_JSON` for key rotation (see platform handbook).

### 3.2 Install dependencies

```bash
cd /path/to/Project-Sammati
npm install
```

### 3.3 Run database migrations

```bash
npm run migrate:up
```

### 3.4 Create company + first API key

```bash
npm run company:bootstrap -- "Your Company Name"
```

Copy **`rawApiKey`** from the JSON output — it is shown **once**.

### 3.5 Start the API server

**Development (watch mode):**

```bash
npm run dev
```

**Production-style (build + node):**

```bash
npm run build
npm run start
```

Default base URL: `http://127.0.0.1:3000` (or `http://localhost:3000`) unless `PORT` is changed.

### 3.6 Health check

```bash
curl -s http://127.0.0.1:3000/healthz
```

Expect: `{"ok":true}`

---

## 4. Obtain an API key

Use the bootstrap script output (`rawApiKey`) or your internal provisioning that inserts into `company_api_keys` (hashed at rest).

**All secured API calls require:**

```http
Authorization: Bearer <RAW_API_KEY>
```

Mutating routes that create resources also require:

```http
Idempotency-Key: <unique string per logical operation>
```

---

## 5. Typical integration sequence

| Step | Action | API |
|------|--------|-----|
| 1 | Publish a **policy** (draft → publish) for your `policy_ref` + `version` | `POST /v1/policies`, `POST /v1/policies/:policyRef/versions/:version/publish` |
| 2 | **Create widget session** with `allowed_origin` = your parent site origin (exact URL, incl. scheme/host/port) | `POST /v1/widget/sessions` |
| 3 | **Embed iframe** pointing to `GET /widget/hosted?session_token=...` | Use `@sammati/widget-sdk` `buildHostedWidgetUrl` + `mountWidgetIframe` |
| 4 | **Listen** for postMessage events (`widget.loaded`, `consent.submitted`, etc.) | `createWidgetListener` from widget-sdk |
| 5 | (Optional) **Server-side consent** without iframe | `POST /v1/consents/grant` (etc.) with same idempotency discipline |

---

## 6. Hosted widget (iframe) checklist

- [ ] `allowed_origin` on session create **exactly matches** the browser parent origin (e.g. `http://localhost:5173` ≠ `http://127.0.0.1:5173`).  
- [ ] Iframe **`sandbox`** includes `allow-scripts allow-forms allow-same-origin` (default in widget-sdk) so bootstrap/submit `fetch` works.  
- [ ] Parent listener uses **ledger origin** as trusted `postMessage` source (widget-sdk default).  
- [ ] Policy row is **PUBLISHED** and `locale` exists in policy JSON.  
- [ ] For troubleshooting CSP, see [internal-p0 §8–9](./internal-p0-ledger-architecture-and-integration.md).

---

## 7. Webhooks (optional)

1. `POST /v1/webhooks/endpoints` with `url`, `events` array (subset of server-supported types), optional `environment`.  
2. Store returned **`signingSecret`** securely.  
3. Run **`npm run worker:webhook`** (or your process supervisor) so deliveries leave `PENDING`.  
4. Verify signature per `docs/phase-c3-webhooks-api-contracts.md`.

Supported event type names are defined in code: `src/services/webhooks/webhookTypes.ts`.

---

## 8. Workers (optional, same machine)

Open **separate terminals** from the API:

| Script | Role |
|--------|------|
| `npm run worker:proof` | Consumes `proof.pending` outbox; builds Merkle batches |
| `npm run worker:anchor-mock` | Simulates anchoring (development) |
| `npm run worker:webhook` | Delivers webhook HTTP calls |

These are **not** required for basic consent API + widget manual testing; they are required for **proof paths** and **webhook delivery** in dev/prod.

---

## 9. Verification commands

From repo root:

```bash
# No database: compile + widget/protocol smoke
npm run verify:freeze-local

# With database: full widget runtime integration test
set DATABASE_URL=...   # Windows CMD
npm run test:widget-runtime

# Sample policy JSON validation (integration prep)
npm run verify:sample-policy-json
```

Workspace SDKs (CI-style):

```bash
npm run build:packages
npm run test:packages
```

---

## 10. Production checklist

- [ ] Strong `API_KEY_HASH_PEPPER` and widget signing secrets; restrict `.env` permissions.  
- [ ] TLS termination in front of Fastify; **HTTPS** for parent and ledger in production.  
- [ ] Rate limits (`@fastify/rate-limit` 300 req/min default) — tune if needed.  
- [ ] Database backups and migration runbook.  
- [ ] Webhook endpoints use HTTPS and validate signatures.  
- [ ] Observability: ship Fastify logs, pool metrics, worker health.

---

## 11. Sample payloads & curl

Operator-maintained examples live under:

- `scripts/integration-prep/README.md`  
- `scripts/integration-prep/examples/manual/*.curl.txt`  
- `scripts/integration-prep/examples/payloads/*.json`  

Use **`sample-newsletter-subscription`** policy ref for a clean walkthrough, or copy JSON and rename `policyRef` to your own.

---

*End of Company Onboarding Handbook.*

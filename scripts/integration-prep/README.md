# Integration prep (non-production)

This directory holds **operator demos**, **manual curl recipes**, **sample JSON payloads**, and **small validation helpers** for local onboarding. Nothing here is imported by the ledger at runtime.

## Layout

| Path | Contents |
|------|-----------|
| `examples/payloads/` | Sample policy drafts and widget session request bodies (generic names). |
| `examples/manual/` | Step-by-step curl text files (Windows `cmd` style where noted). |
| `examples/snippets/` | HTML iframe embed notes for hosted widget. |
| `helpers/` | Node scripts: validate sample policy JSON against domain schema; optional DB row printer. |

## Commands (from repo root)

Ledger freeze smoke (no database): from repo root run `npm run verify:freeze-local` (build + widget-related quick tests + sample policy validation).

```bash
npm run verify:sample-policy-json
```

Validates `examples/payloads/sample-newsletter-policy-v1-draft.json` using the same Zod rules as the API.

## Database helper

```bash
node scripts/integration-prep/helpers/print-integration-db-rows.mjs
```

Requires `DATABASE_URL` in the environment. Prints recent rows for `consents`, `consent_versions`, `events`, and `widget_sessions` filtered by purpose code.

- Default purpose code: `SAMPLE_NEWSLETTER_SUBSCRIPTION`.
- Override: `INTEGRATION_PREP_PURPOSE_CODE=YOUR_PURPOSE`.

## Policy reference in samples

Sample policy ref: **`sample-newsletter-subscription`** (version `1`, locale `en-IN`). If you previously used another `policy_ref` in a local database, either create this policy with the curls in `examples/manual/` or adjust payloads to match your tenant.

## Migrating from older sample names

Earlier commits used `art-mail-subscription` and `ART_MAIL_SUBSCRIPTION` in filenames and payloads. P1 uses neutral **`sample-newsletter-subscription`** / **`SAMPLE_NEWSLETTER_SUBSCRIPTION`**. Re-run the policy + session curls under `examples/manual/` or edit payloads to match data already in your local DB.

## Related docs

- Full architecture map: `docs/internal-p0-ledger-architecture-and-integration.md`
- Runtime and iframe contracts: `docs/phase-c4-*`

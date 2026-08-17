# Phase E.1a.1 — Package and release metadata

Standardization baseline for `@sammati/*` packages. **E.1a.1 does not remove `private: true` or perform publishes.**

---

## Package names and scope

| Package | npm name | Purpose |
|---------|-----------|---------|
| Shared foundation | `@sammati/shared-core` | Errors, transport, shared types |
| Webhooks | `@sammati/webhook-utils` | C.3-compatible signature verification |
| Server | `@sammati/server-sdk` | Typed HTTP client (widget + webhooks MVP) |
| Browser | `@sammati/widget-sdk` | Hosted widget URL, iframe, postMessage listener |

All published artifacts are **`@sammati` scoped**. Unscoped names are not used for these SDKs.

---

## Visibility assumptions

- **Today:** `private: true` on all SDK packages — **not installable from npm**; workspace `file:` links are for monorepo dev only.
- **First public publish:** Remove `private` (or set `private: false`) only when intentionally releasing. `publishConfig.access` is already `"public"` so scoped packages do not default to restricted visibility on npm.

---

## Repository metadata consistency

Each SDK `package.json` includes aligned fields:

- `description` — one-line package purpose
- `repository` — monorepo git URL (`type`, `url`)
- `bugs` — issue tracker URL
- `homepage` — repo URL with readme anchor

The **canonical source** is the monorepo; per-package `repository.directory` may be added in a later milestone for npm “monorepo” navigation (optional).

---

## Version field alignment strategy

- **Current state:** All four SDK packages use the same initial line (`0.1.0`) for simplicity.
- **Ongoing:** Follow [Release policy — version coordination](phase-e1a1-release-policy.md#version-coordination-between-packages).
- **Root `sammati-ledger`:** Version is **independent**; it tracks the application, not the SDK line.

---

## License

- A repo-wide **LICENSE** file is **not** yet defined in this baseline.
- **Before first public npm publish**, the org must set an explicit `license` field and file; until then, packages are treated as **private / unpublished**.

---

## Non-goals (E.1a.1)

- Switching `file:` dependencies to semver (deferred until pre-publish).
- Adding `keywords`, `funding`, or badges unless needed for discoverability later.

---

## Freeze criteria (E.1a.1)

- Metadata fields match across packages; URLs resolve to the canonical repository.
- [Package integrity checklist](phase-e1a1-validation-checklist.md#package-integrity-checklist) passes.

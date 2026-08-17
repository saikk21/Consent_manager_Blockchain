import { strict as assert } from "node:assert";
import pg from "pg";
import { createPool } from "../persistence/db/pool.js";
import { ConsentLifecycleService } from "../services/consentLifecycle/consentLifecycleService.js";
import { WidgetSessionService } from "../services/widget/widgetSessionService.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("SKIP widgetSessions.test.ts (DATABASE_URL not set)");
    return;
  }

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  const pool = createPool();
  const consent = new ConsentLifecycleService(pool);
  const widget = new WidgetSessionService(pool, consent);

  try {
    const companyRes = await admin.query<{ id: string }>(
      "insert into companies (name) values ('WidgetTestCo') returning id",
    );
    const companyId = companyRes.rows[0]!.id;

    const locales = {
      "en-IN": {
        title: "KYC Consent",
        sections: [
          { id: "purpose", text: "p" },
          { id: "data_categories", text: "d" },
          { id: "processing", text: "pr" },
          { id: "retention", text: "r" },
          { id: "withdrawal", text: "w" },
          { id: "grievance", text: "g" },
        ],
      },
    };
    await admin.query(
      `
      insert into policy_artifacts (
        company_id, policy_ref, version, state, default_locale, required_legal_version,
        locales, policy_content_hash, ui_schema_version, published_at
      )
      values ($1,'kyc-consent',1,'PUBLISHED','en-IN','2026-01',$2::jsonb,'hash',1,now())
      `,
      [companyId, JSON.stringify(locales)],
    );

    // lifecycle + single-use success
    const created = await widget.createSession(companyId, {
      external_user_id: "widget-user-1",
      purpose_code: "KYC",
      policy_ref: "kyc-consent",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 600,
    });

    const submit = await widget.submitSession(
      created.sessionId,
      {
        session_token: created.token.sessionToken,
        action: "GRANT",
        occurred_at: new Date().toISOString(),
      },
      "https://app.example.com",
    );
    assert.equal(submit.currentStatus, "GRANTED");

    // replay protection
    let replayRejected = false;
    try {
      await widget.submitSession(
        created.sessionId,
        {
          session_token: created.token.sessionToken,
          action: "GRANT",
          occurred_at: new Date().toISOString(),
        },
        "https://app.example.com",
      );
    } catch {
      replayRejected = true;
    }
    assert.equal(replayRejected, true, "consumed session must reject replay");

    // invalid origin rejection
    const originCase = await widget.createSession(companyId, {
      external_user_id: "widget-user-2",
      purpose_code: "KYC",
      policy_ref: "kyc-consent",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 600,
    });
    let badOriginRejected = false;
    try {
      await widget.submitSession(
        originCase.sessionId,
        {
          session_token: originCase.token.sessionToken,
          action: "GRANT",
          occurred_at: new Date().toISOString(),
        },
        "https://evil.example.com",
      );
    } catch {
      badOriginRejected = true;
    }
    assert.equal(badOriginRejected, true, "invalid origin must be rejected");

    // expiry handling
    const expCase = await widget.createSession(companyId, {
      external_user_id: "widget-user-3",
      purpose_code: "KYC",
      policy_ref: "kyc-consent",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 1,
    });
    await new Promise((r) => setTimeout(r, 1200));
    let expiredRejected = false;
    try {
      await widget.submitSession(
        expCase.sessionId,
        {
          session_token: expCase.token.sessionToken,
          action: "GRANT",
          occurred_at: new Date().toISOString(),
        },
        "https://app.example.com",
      );
    } catch {
      expiredRejected = true;
    }
    assert.equal(expiredRejected, true, "expired session must reject submit");

    // eslint-disable-next-line no-console
    console.log("widget sessions tests passed");
  } finally {
    await pool.end();
    await admin.end();
  }
}

await main();


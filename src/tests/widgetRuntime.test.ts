import { strict as assert } from "node:assert";
import pg from "pg";
import { createPool } from "../persistence/db/pool.js";
import { ConsentLifecycleService } from "../services/consentLifecycle/consentLifecycleService.js";
import { WidgetSessionService } from "../services/widget/widgetSessionService.js";
import { WidgetRuntimeService } from "../services/widget/widgetRuntimeService.js";
import { WidgetPostMessageSchema } from "../services/widget/widgetRuntimeContract.js";
import { buildServer } from "../server.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("SKIP widgetRuntime.test.ts (DATABASE_URL not set)");
    return;
  }

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  const pool = createPool();
  const consent = new ConsentLifecycleService(pool);
  const widgetSession = new WidgetSessionService(pool, consent);
  const runtime = new WidgetRuntimeService(pool);

  try {
    const companyRes = await admin.query<{ id: string }>(
      "insert into companies (name) values ('WidgetRuntimeCo') returning id",
    );
    const companyId = companyRes.rows[0]!.id;

    const locales = {
      "en-IN": {
        title: "Consent Form",
        sections: [
          { id: "processing", text: "processing text" },
          { id: "purpose", text: "purpose text" },
          { id: "retention", text: "retention text" },
          { id: "grievance", text: "grievance text" },
          { id: "withdrawal", text: "withdrawal text" },
          { id: "data_categories", text: "data categories text" },
          { id: "custom_extra", text: "extra text" },
        ],
      },
      "hi-IN": {
        title: "Sahmati Form",
        sections: [
          { id: "purpose", text: "uddeshya" },
          { id: "data_categories", text: "shreni" },
          { id: "processing", text: "prakriya" },
          { id: "retention", text: "rakshan" },
          { id: "withdrawal", text: "wapasi" },
          { id: "grievance", text: "shikayat" },
        ],
      },
    };
    await admin.query(
      `
      insert into policy_artifacts (
        company_id, policy_ref, version, state, default_locale, required_legal_version,
        locales, policy_content_hash, ui_schema_version, published_at
      ) values ($1,'runtime-policy',1,'PUBLISHED','en-IN','2026-01',$2::jsonb,'hash',1,now())
      `,
      [companyId, JSON.stringify(locales)],
    );

    const created = await widgetSession.createSession(companyId, {
      external_user_id: "runtime-user-1",
      purpose_code: "KYC",
      policy_ref: "runtime-policy",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 600,
    });

    const boot = await runtime.bootstrap({
      session_token: created.token.sessionToken,
      parent_origin: "https://app.example.com",
    });
    assert.equal(boot.session.status, "ISSUED");
    assert.deepEqual(
      boot.policy.sections.map((s) => s.id),
      [
        "purpose",
        "data_categories",
        "processing",
        "retention",
        "withdrawal",
        "grievance",
        "custom_extra",
      ],
    );

    let badOriginRejected = false;
    try {
      await runtime.bootstrap({
        session_token: created.token.sessionToken,
        parent_origin: "https://evil.example.com",
      });
    } catch {
      badOriginRejected = true;
    }
    assert.equal(badOriginRejected, true, "parent origin mismatch should reject");

    const expired = await widgetSession.createSession(companyId, {
      external_user_id: "runtime-user-2",
      purpose_code: "KYC",
      policy_ref: "runtime-policy",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 1,
    });
    await sleep(1200);
    const expiredBoot = await runtime.bootstrap({
      session_token: expired.token.sessionToken,
      parent_origin: "https://app.example.com",
    });
    assert.equal(expiredBoot.session.status, "EXPIRED");

    const consumed = await widgetSession.createSession(companyId, {
      external_user_id: "runtime-user-3",
      purpose_code: "KYC",
      policy_ref: "runtime-policy",
      policy_version: 1,
      locale: "hi-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 600,
    });
    await widgetSession.submitSession(
      consumed.sessionId,
      {
        session_token: consumed.token.sessionToken,
        action: "GRANT",
        occurred_at: new Date().toISOString(),
      },
      "https://app.example.com",
    );
    const consumedBoot = await runtime.bootstrap({
      session_token: consumed.token.sessionToken,
      parent_origin: "https://app.example.com",
    });
    assert.equal(consumedBoot.session.status, "CONSUMED");
    assert.equal(consumedBoot.session.locale, "hi-IN");

    const cancelled = await widgetSession.createSession(companyId, {
      external_user_id: "runtime-user-4",
      purpose_code: "KYC",
      policy_ref: "runtime-policy",
      policy_version: 1,
      locale: "en-IN",
      allowed_origin: "https://app.example.com",
      ttl_seconds: 600,
    });
    await widgetSession.cancelSession(cancelled.sessionId);
    const cancelledBoot = await runtime.bootstrap({
      session_token: cancelled.token.sessionToken,
      parent_origin: "https://app.example.com",
    });
    assert.equal(cancelledBoot.session.status, "CANCELLED");

    const events = [
      "widget.ready",
      "widget.loaded",
      "widget.resized",
      "consent.submitted",
      "consent.failed",
      "widget.error",
    ] as const;
    for (const event of events) {
      const validMessage = WidgetPostMessageSchema.parse({
        version: "1.0",
        event,
        payload: {},
      });
      assert.equal(validMessage.event, event);
    }
    const invalidMessage = WidgetPostMessageSchema.safeParse({
      version: "1.0",
      event: "widget.unknown",
      payload: {},
    });
    assert.equal(invalidMessage.success, false);
    const invalidVersion = WidgetPostMessageSchema.safeParse({
      version: "2.0",
      event: "widget.ready",
      payload: {},
    });
    assert.equal(invalidVersion.success, false);

    const app = await buildServer();
    const hosted = await app.inject({
      method: "GET",
      url: `/widget/hosted?session_token=${encodeURIComponent(created.token.sessionToken)}`,
    });
    assert.equal(hosted.statusCode, 200);
    const csp = hosted.headers["content-security-policy"] ?? "";
    assert.equal(csp.includes("frame-ancestors https://app.example.com"), true);
    await app.close();

    // eslint-disable-next-line no-console
    console.log("widget runtime tests passed");
  } finally {
    await pool.end();
    await admin.end();
  }
}

await main();


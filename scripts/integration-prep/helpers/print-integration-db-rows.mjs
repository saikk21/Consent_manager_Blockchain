import "dotenv/config";
import pg from "pg";

const purpose =
  process.env.INTEGRATION_PREP_PURPOSE_CODE ?? "SAMPLE_NEWSLETTER_SUBSCRIPTION";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const consents = await pool.query(
    `SELECT * FROM consents WHERE purpose_code = $1 ORDER BY updated_at DESC`,
    [purpose],
  );
  console.log("=== consents (" + purpose + ") ===");
  console.log(JSON.stringify(consents.rows, null, 2));

  const ids = consents.rows.map((r) => r.id);
  if (ids.length === 0) {
    console.log("\n(No consent rows.)");
  } else {
    const versions = await pool.query(
      `SELECT * FROM consent_versions WHERE consent_id = ANY($1::uuid[]) ORDER BY consent_id, version_no`,
      [ids],
    );
    console.log("\n=== consent_versions (those consents) ===");
    console.log(JSON.stringify(versions.rows, null, 2));

    const events = await pool.query(
      `SELECT * FROM events WHERE consent_id = ANY($1::uuid[]) ORDER BY consent_id, version_no`,
      [ids],
    );
    console.log("\n=== events (those consents) ===");
    console.log(JSON.stringify(events.rows, null, 2));
  }

  const sessions = await pool.query(
    `SELECT * FROM widget_sessions WHERE purpose_code = $1 ORDER BY updated_at DESC`,
    [purpose],
  );
  console.log("\n=== widget_sessions (" + purpose + ") ===");
  console.log(JSON.stringify(sessions.rows, null, 2));
} finally {
  await pool.end();
}

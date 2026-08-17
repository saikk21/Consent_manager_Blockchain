import { strict as assert } from "node:assert";
import pg from "pg";
import { computePolicyContentHash } from "../domain/policy/hashing.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("SKIP policyArtifacts.test.ts (DATABASE_URL not set)");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const company = await client.query<{ id: string }>(
      "insert into companies (name) values ('PolicyTestCo') returning id",
    );
    const companyId = company.rows[0]!.id;

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

    const hash1 = computePolicyContentHash({
      companyId,
      policyRef: "kyc",
      version: 1,
      defaultLocale: "en-IN",
      requiredLegalVersion: "2026-01",
      locales,
      uiSchemaVersion: 1,
    });
    const hash2 = computePolicyContentHash({
      companyId,
      policyRef: "kyc",
      version: 1,
      defaultLocale: "en-IN",
      requiredLegalVersion: "2026-01",
      locales,
      uiSchemaVersion: 1,
    });
    assert.equal(hash1, hash2, "policy content hash must be deterministic");

    const draft = await client.query(
      `
      insert into policy_artifacts (
        company_id, policy_ref, version, state, default_locale, required_legal_version,
        locales, policy_content_hash, ui_schema_version
      )
      values ($1,'kyc',1,'DRAFT','en-IN','2026-01',$2::jsonb,$3,1)
      returning id
      `,
      [companyId, JSON.stringify(locales), hash1],
    );
    const policyId = draft.rows[0]!.id as string;

    // publish
    await client.query(
      "update policy_artifacts set state='PUBLISHED', published_at=now() where id=$1",
      [policyId],
    );

    // attempt mutation should fail (immutability trigger)
    let threw = false;
    try {
      await client.query("update policy_artifacts set default_locale='fr-FR' where id=$1", [policyId]);
    } catch {
      threw = true;
    }
    assert.equal(threw, true, "published policy must be immutable at DB level");

    // eslint-disable-next-line no-console
    console.log("policy artifacts tests passed");
  } finally {
    await client.end();
  }
}

await main();


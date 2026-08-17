type TestConfig = Readonly<{
  baseUrl: string;
  apiKey: string;
  externalUserId: string;
  purposeCode: string;
}>;

async function postConsent(
  cfg: TestConfig,
  action: "grant" | "update" | "revoke",
  idempotencyKey: string,
  policyRef: string,
) {
  const response = await fetch(`${cfg.baseUrl}/v1/consents/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({
      external_user_id: cfg.externalUserId,
      purpose_code: cfg.purposeCode,
      policy_ref: policyRef,
      occurred_at: new Date().toISOString(),
    }),
  });
  return response.json();
}

async function getJson(url: string, apiKey: string) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });
  return response.json();
}

async function main() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    throw new Error("Usage: npm run test:lifecycle -- <raw_api_key>");
  }

  const cfg: TestConfig = {
    baseUrl: process.env.API_BASE_URL ?? "http://localhost:3000",
    apiKey,
    externalUserId: process.env.TEST_EXTERNAL_USER_ID ?? "ext-user-1",
    purposeCode: process.env.TEST_PURPOSE_CODE ?? "KYC",
  };

  const grant = await postConsent(cfg, "grant", "sample-grant-1", "policy-v1");
  const update = await postConsent(cfg, "update", "sample-update-1", "policy-v2");
  const revoke = await postConsent(cfg, "revoke", "sample-revoke-1", "policy-v2");

  const status = await getJson(
    `${cfg.baseUrl}/v1/consents/status?external_user_id=${encodeURIComponent(cfg.externalUserId)}&purpose_code=${encodeURIComponent(cfg.purposeCode)}`,
    cfg.apiKey,
  );

  const timeline = await getJson(
    `${cfg.baseUrl}/v1/consents/timeline?external_user_id=${encodeURIComponent(cfg.externalUserId)}&purpose_code=${encodeURIComponent(cfg.purposeCode)}&cursor=0&limit=10`,
    cfg.apiKey,
  );

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        grant,
        update,
        revoke,
        status,
        timeline,
      },
      null,
      2,
    ),
  );
}

await main();

export {};


import { describe, expect, it } from "vitest";
import { createSammatiClient } from "../src/index.js";

const baseUrl = process.env.SAMMATI_BASE_URL;
const apiKey = process.env.SAMMATI_API_KEY;

describe("server-sdk integration smoke", () => {
  it.skipIf(!baseUrl || !apiKey)(
    "calls live list/create webhook endpoints",
    async () => {
      const client = createSammatiClient({
        baseUrl: baseUrl!,
        apiKey: apiKey!,
        timeoutMs: 5_000,
      });

      const listed = await client.webhooks.listEndpoints({ limit: 5 });
      expect(Array.isArray(listed.items)).toBe(true);

      const created = await client.webhooks.createEndpoint({
        url: "https://example.com/smoke-webhook",
        events: ["consent.recorded"],
        environment: "dev",
      });
      expect(created.endpointId).toBeTruthy();
      expect(created.status).toBe("ACTIVE");
    },
    20_000,
  );
});

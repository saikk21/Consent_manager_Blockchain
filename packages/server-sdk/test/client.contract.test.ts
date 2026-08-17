import { describe, expect, it } from "vitest";
import { SammatiError, type Transport, type TransportRequest } from "@sammati/shared-core";
import { createIdempotencyKey, createSammatiClient } from "../src/index.js";

describe("server-sdk contract behavior", () => {
  it("adds auth header for secured endpoints", async () => {
    const seen: Array<Record<string, string> | undefined> = [];
    const transport: Transport = {
      request: async <TResponse>(input: TransportRequest): Promise<TResponse> => {
        seen.push(input.options?.headers);
        return { items: [], page: { limit: 20, nextCursor: null, hasMore: false } } as TResponse;
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
    });
    await client.webhooks.listEndpoints();
    expect(seen[0]?.authorization).toBe("Bearer test_key");
  });

  it("does not add auth header to public runtime bootstrap", async () => {
    let headers: Record<string, string> | undefined;
    const transport: Transport = {
      request: async <TResponse>(input: TransportRequest): Promise<TResponse> => {
        headers = input.options?.headers;
        return {
          version: "1.0",
          session: {
            session_id: "s",
            status: "ISSUED",
            expires_at: "2026-01-01T00:00:00.000Z",
            allowed_origin: "https://app.example.com",
            locale: "en-IN",
            purpose_code: "KYC",
            render_hash: "h",
          },
          policy: {
            policy_ref: "p",
            policy_version: 1,
            title: "t",
            required_legal_version: "2026-01",
            ui_schema_version: 1,
            sections: [],
          },
        } as TResponse;
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
    });
    await client.widgetRuntime.bootstrap({ session_token: "x".repeat(30) });
    expect(headers?.authorization).toBeUndefined();
  });

  it("auto-generates idempotency key for write operations", async () => {
    let idempotencyHeader = "";
    const transport: Transport = {
      request: async <TResponse>(input: TransportRequest): Promise<TResponse> => {
        idempotencyHeader = input.options?.idempotencyKey ?? "";
        return {
          endpointId: "e",
          url: "https://example.com/webhook",
          events: ["consent.recorded"],
          environment: "dev",
          status: "ACTIVE",
          signingSecret: "whsec",
          createdAt: new Date().toISOString(),
        } as TResponse;
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
    });
    await client.webhooks.createEndpoint({
      url: "https://example.com/webhook",
      events: ["consent.recorded"],
    });
    expect(idempotencyHeader.length).toBeGreaterThan(0);
  });

  it("retries transient errors and succeeds", async () => {
    let calls = 0;
    const transport: Transport = {
      request: async <TResponse>(): Promise<TResponse> => {
        calls += 1;
        if (calls === 1) {
          throw new SammatiError({ type: "network", message: "Temporary network issue" });
        }
        return { items: [], page: { limit: 20, nextCursor: null, hasMore: false } } as TResponse;
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 },
    });
    await client.webhooks.listEndpoints();
    expect(calls).toBe(2);
  });

  it("does not retry non-transient errors", async () => {
    let calls = 0;
    const transport: Transport = {
      request: async () => {
        calls += 1;
        throw new SammatiError({ type: "validation", message: "Bad request", statusCode: 400 });
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
      retry: { maxAttempts: 3 },
    });
    await expect(client.webhooks.listEndpoints()).rejects.toMatchObject({ type: "validation" });
    expect(calls).toBe(1);
  });

  it("normalizes unknown errors to SammatiError", async () => {
    const transport: Transport = {
      request: async () => {
        throw new Error("random failure");
      },
    };
    const client = createSammatiClient({
      baseUrl: "http://localhost:3000",
      apiKey: "test_key",
      transport,
    });
    await expect(client.webhooks.listEndpoints()).rejects.toMatchObject({ type: "network" });
  });

  it("creates deterministic idempotency key shape", () => {
    const key = createIdempotencyKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(20);
  });
});

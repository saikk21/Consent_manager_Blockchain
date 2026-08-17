import { describe, expect, it } from "vitest";
import { createFetchTransport } from "../src/transport.js";
import { SammatiError } from "../src/errors.js";

describe("createFetchTransport", () => {
  it("normalizes http errors", async () => {
    const transport = createFetchTransport(async () => {
      return new Response(JSON.stringify({ message: "invalid payload" }), { status: 400 });
    });

    await expect(
      transport.request({
        baseUrl: "https://api.example.com",
        path: "/v1/test",
        method: "POST",
        body: {},
      }),
    ).rejects.toMatchObject({ type: "validation", statusCode: 400 });
  });

  it("enforces timeout through abort signal", async () => {
    const transport = createFetchTransport(async (_input, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
      return new Response("{}");
    });

    let caught: unknown;
    try {
      await transport.request({
        baseUrl: "https://api.example.com",
        path: "/slow",
        method: "GET",
        options: { timeoutMs: 20 },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SammatiError);
    expect((caught as SammatiError).type).toBe("timeout");
  });
});

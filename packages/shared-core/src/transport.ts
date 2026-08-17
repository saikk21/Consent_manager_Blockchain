import { SammatiError, classifyHttpError, normalizeUnknownError } from "./errors.js";
import { createTimeoutSignal } from "./timeout.js";
import type { RequestMethod, RequestOptions } from "./types.js";

export type TransportRequest = Readonly<{
  baseUrl: string;
  path: string;
  method: RequestMethod;
  body?: unknown;
  options?: RequestOptions;
}>;

export type Transport = Readonly<{
  request<TResponse>(input: TransportRequest): Promise<TResponse>;
}>;

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function createFetchTransport(fetchImpl: typeof fetch = fetch): Transport {
  return {
    async request<TResponse>(input: TransportRequest): Promise<TResponse> {
      const { signal, cleanup } = createTimeoutSignal(input.options?.timeoutMs, input.options?.signal);
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          ...(input.options?.headers ?? {}),
        };
        if (input.options?.idempotencyKey) {
          headers["idempotency-key"] = input.options.idempotencyKey;
        }

        const res = await fetchImpl(buildUrl(input.baseUrl, input.path, input.options?.query), {
          method: input.method,
          headers,
          signal,
          body: input.body === undefined ? undefined : JSON.stringify(input.body),
        });
        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;
        if (!res.ok) {
          throw new SammatiError({
            type: classifyHttpError(res.status),
            message: parsed?.message ?? `Request failed with ${res.status}`,
            statusCode: res.status,
            requestId: res.headers.get("x-request-id") ?? undefined,
            details: parsed,
          });
        }
        return parsed as TResponse;
      } catch (error) {
        throw normalizeUnknownError(error);
      } finally {
        cleanup();
      }
    },
  };
}

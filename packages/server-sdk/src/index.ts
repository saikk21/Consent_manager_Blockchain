import { randomUUID } from "node:crypto";
import {
  SammatiError,
  createFetchTransport,
  normalizeUnknownError,
  type ApiListResponse,
  type RequestOptions,
  type Transport,
  type WidgetMessageVersion,
} from "@sammati/shared-core";

export type RetryConfig = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}>;

export type SammatiClientConfig = Readonly<{
  baseUrl: string;
  apiKey?: string;
  apiKeyProvider?: () => string | Promise<string>;
  timeoutMs?: number;
  retry?: Partial<RetryConfig>;
  transport?: Transport;
}>;

export type ServerRequestOptions = RequestOptions;

export type WidgetSessionCreateRequest = Readonly<{
  external_user_id: string;
  purpose_code: string;
  policy_ref: string;
  policy_version: number;
  locale: string;
  allowed_origin: string;
  environment?: string;
  ttl_seconds?: number;
}>;

export type WidgetSessionCreateResponse = Readonly<{
  sessionId: string;
  expiresAt: string;
  render: Readonly<{ renderHash: string; uiSchemaVersion: number }>;
  token: Readonly<{ sessionToken: string }>;
}>;

export type WidgetSessionGetResponse = Readonly<{
  sessionId: string;
  status: "ISSUED" | "STARTED" | "CONSUMED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  consent: null | {
    consentId: string | null;
    eventId: string | null;
    versionNo: number | null;
    currentStatus: string | null;
  };
}>;

export type WidgetSessionSubmitRequest = Readonly<{
  session_token: string;
  action: "GRANT" | "UPDATE" | "REVOKE";
  occurred_at: string;
  embed_origin?: string;
}>;

export type WidgetSessionSubmitResponse = Readonly<{
  consentId: string;
  eventId: string;
  versionNo: number;
  currentStatus: "NONE" | "GRANTED" | "REVOKED";
  proofStatus: "PENDING";
}>;

export type WidgetRuntimeBootstrapRequest = Readonly<{
  session_token: string;
  parent_origin?: string;
}>;

export type WidgetRuntimeBootstrapResponse = Readonly<{
  version: WidgetMessageVersion;
  session: {
    session_id: string;
    status: "ISSUED" | "STARTED" | "CONSUMED" | "EXPIRED" | "CANCELLED";
    expires_at: string;
    allowed_origin: string;
    locale: string;
    purpose_code: string;
    render_hash: string;
    state_reason?: string;
  };
  policy: {
    policy_ref: string;
    policy_version: number;
    title: string;
    required_legal_version: string;
    ui_schema_version: number;
    sections: Array<{ id: string; text: string }>;
  };
}>;

export type WebhookCreateEndpointRequest = Readonly<{
  url: string;
  events: Array<
    | "consent.recorded"
    | "proof.ready"
    | "proof.anchor_confirmed"
    | "widget.session.created"
    | "widget.session.consumed"
  >;
  environment?: string;
}>;

export type WebhookCreateEndpointResponse = Readonly<{
  endpointId: string;
  url: string;
  events: string[];
  environment: string;
  status: "ACTIVE" | "PAUSED";
  signingSecret: string;
  createdAt: string;
}>;

export type WebhookListEndpointItem = Readonly<{
  endpointId: string;
  url: string;
  events: string[];
  environment: string;
  status: "ACTIVE" | "PAUSED";
  signatureAlgorithm: string;
  createdAt: string;
}>;

export type WebhookListEndpointsResponse = ApiListResponse<WebhookListEndpointItem>;

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  jitterRatio: 0.2,
};

function mergeRetry(config?: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_RETRY, ...(config ?? {}) };
}

function createBackoffMs(retry: RetryConfig, attemptNo: number): number {
  const exp = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** Math.max(0, attemptNo - 1));
  const jitter = Math.floor(exp * retry.jitterRatio * Math.random());
  return exp + jitter;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(error: SammatiError): boolean {
  return error.type === "network" || error.type === "timeout" || error.type === "server" || error.type === "rate_limit";
}

function shouldRetry(
  error: SammatiError,
  method: "GET" | "POST",
  hasIdempotencyKey: boolean,
): boolean {
  if (!isTransientError(error)) return false;
  if (method === "GET") return true;
  return hasIdempotencyKey;
}

export function createIdempotencyKey(): string {
  return randomUUID();
}

export type SammatiClient = Readonly<{
  widgetSessions: {
    create: (
      body: WidgetSessionCreateRequest,
      options?: ServerRequestOptions,
    ) => Promise<WidgetSessionCreateResponse>;
    get: (sessionId: string, options?: ServerRequestOptions) => Promise<WidgetSessionGetResponse>;
    submit: (
      sessionId: string,
      body: WidgetSessionSubmitRequest,
      options?: ServerRequestOptions,
    ) => Promise<WidgetSessionSubmitResponse>;
  };
  widgetRuntime: {
    bootstrap: (
      body: WidgetRuntimeBootstrapRequest,
      options?: ServerRequestOptions,
    ) => Promise<WidgetRuntimeBootstrapResponse>;
  };
  webhooks: {
    createEndpoint: (
      body: WebhookCreateEndpointRequest,
      options?: ServerRequestOptions,
    ) => Promise<WebhookCreateEndpointResponse>;
    listEndpoints: (
      query?: Readonly<{ cursor?: number; limit?: number }>,
      options?: ServerRequestOptions,
    ) => Promise<WebhookListEndpointsResponse>;
  };
}>;

export function createSammatiClient(config: SammatiClientConfig): SammatiClient {
  const transport = config.transport ?? createFetchTransport();
  const retry = mergeRetry(config.retry);

  const authHeader = async (): Promise<Record<string, string>> => {
    const key = config.apiKeyProvider ? await config.apiKeyProvider() : config.apiKey;
    if (!key) return {};
    return { authorization: `Bearer ${key}` };
  };

  async function runWithRetry<T>(input: Readonly<{
    path: string;
    method: "GET" | "POST";
    body?: unknown;
    requireAuth: boolean;
    options?: ServerRequestOptions;
    forceIdempotency?: boolean;
    extraHeaders?: Record<string, string>;
  }>): Promise<T> {
    const hasIdempotency =
      Boolean(input.options?.idempotencyKey) || Boolean(input.forceIdempotency && input.method === "POST");
    const requestIdempotencyKey =
      input.options?.idempotencyKey ??
      (input.forceIdempotency && input.method === "POST" ? createIdempotencyKey() : undefined);

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const headers: Record<string, string> = {
          ...(input.options?.headers ?? {}),
          ...(input.extraHeaders ?? {}),
          ...(input.requireAuth ? await authHeader() : {}),
        };
        return await transport.request<T>({
          baseUrl: config.baseUrl,
          path: input.path,
          method: input.method,
          body: input.body,
          options: {
            ...input.options,
            timeoutMs: input.options?.timeoutMs ?? config.timeoutMs,
            headers,
            idempotencyKey: requestIdempotencyKey,
          },
        });
      } catch (err) {
        const normalized = normalizeUnknownError(err);
        if (!(normalized instanceof SammatiError)) throw normalized;
        if (attempt >= retry.maxAttempts || !shouldRetry(normalized, input.method, hasIdempotency)) {
          throw normalized;
        }
        await sleep(createBackoffMs(retry, attempt));
      }
    }
  }

  return {
    widgetSessions: {
      create: (body, options) =>
        runWithRetry({
          path: "/v1/widget/sessions",
          method: "POST",
          body,
          options,
          requireAuth: true,
          forceIdempotency: true,
        }),
      get: (sessionId, options) =>
        runWithRetry({
          path: `/v1/widget/sessions/${sessionId}`,
          method: "GET",
          options,
          requireAuth: true,
        }),
      submit: (sessionId, body, options) =>
        runWithRetry({
          path: `/v1/widget/sessions/${sessionId}/submit`,
          method: "POST",
          body: {
            session_token: body.session_token,
            action: body.action,
            occurred_at: body.occurred_at,
          },
          options,
          requireAuth: false,
          forceIdempotency: false,
          extraHeaders: body.embed_origin
            ? {
                "x-sammati-embed-origin": body.embed_origin,
              }
            : undefined,
        }),
    },
    widgetRuntime: {
      bootstrap: (body, options) =>
        runWithRetry({
          path: "/v1/widget/runtime/bootstrap",
          method: "POST",
          body,
          options,
          requireAuth: false,
          forceIdempotency: false,
        }),
    },
    webhooks: {
      createEndpoint: (body, options) =>
        runWithRetry({
          path: "/v1/webhooks/endpoints",
          method: "POST",
          body,
          options,
          requireAuth: true,
          forceIdempotency: true,
        }),
      listEndpoints: (query, options) =>
        runWithRetry({
          path: "/v1/webhooks/endpoints",
          method: "GET",
          options: {
            ...options,
            query: {
              cursor: query?.cursor ?? 0,
              limit: query?.limit ?? 20,
            },
          },
          requireAuth: true,
        }),
    },
  };
}

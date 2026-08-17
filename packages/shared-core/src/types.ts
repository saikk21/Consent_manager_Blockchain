export type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RequestOptions = Readonly<{
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
}>;

export type ApiPage = Readonly<{
  limit: number;
  nextCursor: number | null;
  hasMore: boolean;
}>;

export type ApiListResponse<T> = Readonly<{
  items: T[];
  page: ApiPage;
}>;

import type { WidgetMessageVersion, WidgetRuntimeEvent } from "./widgetProtocol.js";

export type { WidgetMessageVersion, WidgetRuntimeEvent } from "./widgetProtocol.js";

export type WidgetEventEnvelope<TPayload = Record<string, unknown>> = Readonly<{
  version: WidgetMessageVersion;
  event: WidgetRuntimeEvent;
  payload: TPayload;
}>;

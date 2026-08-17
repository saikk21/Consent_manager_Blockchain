/**
 * Centralized mapping from widget service `Error.message` substrings to HTTP errors.
 * Must stay aligned with WidgetSessionService / WidgetRuntimeService throw messages.
 */

/** Structural match for `@fastify/sensible` httpErrors (throws return HttpError, not `never`). */
export type WidgetHttpErrors = Readonly<{
  gone: (msg: string) => unknown;
  conflict: (msg: string) => unknown;
  badRequest: (msg: string) => unknown;
  notFound: (msg: string) => unknown;
}>;

export function widgetServiceErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Mirrors previous inline logic in registerWidgetRuntimeRoutes (bootstrap). */
export function classifyWidgetBootstrapServiceMessage(msg: string): "gone" | "conflict" | "bad_request" {
  if (msg.includes("expired")) return "gone";
  if (msg.includes("consumed") || msg.includes("cancelled")) return "conflict";
  return "bad_request";
}

/** Mirrors previous inline logic in registerWidgetSessionRoutes (submit). */
export function classifyWidgetSubmitServiceMessage(
  msg: string,
): "gone" | "conflict" | "not_found" | "bad_request" {
  if (msg.includes("expired")) return "gone";
  if (msg.includes("already consumed")) return "conflict";
  if (msg.includes("not found")) return "not_found";
  return "bad_request";
}

export function throwWidgetBootstrapServiceError(
  httpErrors: Pick<WidgetHttpErrors, "gone" | "conflict" | "badRequest">,
  err: unknown,
  fallbackMessage: string,
): never {
  const msg = widgetServiceErrorMessage(err, fallbackMessage);
  switch (classifyWidgetBootstrapServiceMessage(msg)) {
    case "gone":
      throw httpErrors.gone(msg);
    case "conflict":
      throw httpErrors.conflict(msg);
    default:
      throw httpErrors.badRequest(msg);
  }
}

export function throwWidgetSubmitServiceError(
  httpErrors: WidgetHttpErrors,
  err: unknown,
  fallbackMessage: string,
): never {
  const msg = widgetServiceErrorMessage(err, fallbackMessage);
  switch (classifyWidgetSubmitServiceMessage(msg)) {
    case "gone":
      throw httpErrors.gone(msg);
    case "conflict":
      throw httpErrors.conflict(msg);
    case "not_found":
      throw httpErrors.notFound(msg);
    default:
      throw httpErrors.badRequest(msg);
  }
}

export function throwWidgetSessionCreateServiceError(
  httpErrors: Pick<WidgetHttpErrors, "badRequest">,
  err: unknown,
  fallbackMessage: string,
): never {
  const msg = widgetServiceErrorMessage(err, fallbackMessage);
  throw httpErrors.badRequest(msg);
}

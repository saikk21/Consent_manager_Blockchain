export type SammatiErrorType =
  | "auth"
  | "validation"
  | "conflict"
  | "not_found"
  | "rate_limit"
  | "server"
  | "network"
  | "timeout"
  | "unknown";

export type SammatiErrorInput = Readonly<{
  type: SammatiErrorType;
  message: string;
  statusCode?: number;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
}>;

export class SammatiError extends Error {
  readonly type: SammatiErrorType;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(input: SammatiErrorInput) {
    super(input.message);
    this.name = "SammatiError";
    this.type = input.type;
    this.statusCode = input.statusCode;
    this.requestId = input.requestId;
    this.details = input.details;
    if (input.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = input.cause;
    }
  }
}

export function classifyHttpError(statusCode?: number): SammatiErrorType {
  if (!statusCode) return "unknown";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 404) return "not_found";
  if (statusCode === 409) return "conflict";
  if (statusCode === 429) return "rate_limit";
  if (statusCode >= 400 && statusCode < 500) return "validation";
  if (statusCode >= 500) return "server";
  return "unknown";
}

export function normalizeUnknownError(input: unknown): SammatiError {
  if (input instanceof SammatiError) return input;
  if (input instanceof Error && input.name === "AbortError") {
    return new SammatiError({
      type: "timeout",
      message: "Request timed out or was aborted.",
      cause: input,
    });
  }
  if (input instanceof Error) {
    return new SammatiError({
      type: "network",
      message: input.message,
      cause: input,
    });
  }
  return new SammatiError({
    type: "unknown",
    message: "Unknown error",
    details: input,
  });
}

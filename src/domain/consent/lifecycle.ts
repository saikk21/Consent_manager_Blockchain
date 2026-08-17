import type {
  ConsentAction,
  ConsentEventType,
  ConsentStatus,
} from "./types.js";

export class DomainError extends Error {
  readonly code:
    | "INVALID_TRANSITION"
    | "CONSENT_NOT_FOUND"
    | "CONSENT_ALREADY_EXISTS"
    | "VALIDATION_ERROR";

  constructor(
    code: DomainError["code"],
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
  }
}

export function actionToEventType(action: ConsentAction): ConsentEventType {
  switch (action) {
    case "GRANT":
      return "CONSENT_GRANTED";
    case "UPDATE":
      return "CONSENT_UPDATED";
    case "REVOKE":
      return "CONSENT_REVOKED";
  }
}

export function nextStatusForAction(
  current: ConsentStatus,
  action: ConsentAction,
): ConsentStatus {
  // Timeline rules (MVP):
  // - NONE -> GRANT allowed
  // - GRANTED -> UPDATE/REVOKE allowed
  // - REVOKED -> GRANT allowed
  // - REVOKED -> UPDATE not allowed
  if (current === "NONE") {
    if (action === "GRANT") return "GRANTED";
    throw new DomainError(
      "CONSENT_NOT_FOUND",
      "Cannot update/revoke a non-existent consent timeline.",
    );
  }

  if (current === "GRANTED") {
    if (action === "GRANT") {
      throw new DomainError(
        "INVALID_TRANSITION",
        "Cannot GRANT when consent is already granted. Use UPDATE or REVOKE.",
      );
    }
    if (action === "UPDATE") return "GRANTED";
    if (action === "REVOKE") return "REVOKED";
  }

  if (current === "REVOKED") {
    if (action === "GRANT") return "GRANTED";
    throw new DomainError(
      "INVALID_TRANSITION",
      "Cannot UPDATE/REVOKE when consent is revoked. Re-grant first.",
    );
  }

  throw new DomainError("VALIDATION_ERROR", "Unknown consent status/action.");
}


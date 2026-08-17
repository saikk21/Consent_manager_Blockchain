export type CompanyId = string;
export type ConsentId = string;
export type EventId = string;

export type ExternalUserId = string;
export type PurposeCode = string;

export type ConsentStatus = "NONE" | "GRANTED" | "REVOKED";

export type ConsentAction = "GRANT" | "UPDATE" | "REVOKE";

export type ConsentEventType =
  | "CONSENT_GRANTED"
  | "CONSENT_UPDATED"
  | "CONSENT_REVOKED";

export type VersionNo = number;

export type PolicyRef = string;


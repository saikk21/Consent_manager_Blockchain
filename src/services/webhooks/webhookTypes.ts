export const WebhookEventTypes = [
  "consent.recorded",
  "proof.ready",
  "proof.anchor_confirmed",
  "widget.session.created",
  "widget.session.consumed",
] as const;

export type WebhookEventType = (typeof WebhookEventTypes)[number];


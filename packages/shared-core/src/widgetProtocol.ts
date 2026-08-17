/**
 * Single source of truth for hosted widget postMessage + bootstrap JSON version.
 * Keep wire strings identical when changing this module — browser + SDK rely on them.
 */
export const WIDGET_MESSAGE_VERSION = "1.0" as const;
export type WidgetMessageVersion = typeof WIDGET_MESSAGE_VERSION;

/** Wire-format event names (postMessage `event` field). */
export const WIDGET_EVENTS = {
  ready: "widget.ready",
  loaded: "widget.loaded",
  resized: "widget.resized",
  consentSubmitted: "consent.submitted",
  consentFailed: "consent.failed",
  error: "widget.error",
} as const;

export type WidgetRuntimeEvent = (typeof WIDGET_EVENTS)[keyof typeof WIDGET_EVENTS];

/** Tuple for Zod `z.enum` / allowlists — order matches historical `WidgetEventNameSchema`. */
export const WIDGET_RUNTIME_EVENT_LIST = [
  WIDGET_EVENTS.ready,
  WIDGET_EVENTS.loaded,
  WIDGET_EVENTS.resized,
  WIDGET_EVENTS.consentSubmitted,
  WIDGET_EVENTS.consentFailed,
  WIDGET_EVENTS.error,
] as const satisfies readonly WidgetRuntimeEvent[];

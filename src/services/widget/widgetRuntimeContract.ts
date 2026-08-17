import { z } from "zod";
import {
  WIDGET_MESSAGE_VERSION,
  WIDGET_RUNTIME_EVENT_LIST,
} from "@sammati/shared-core";

/** Same value as `WIDGET_MESSAGE_VERSION` from `@sammati/shared-core` — re-exported for existing imports. */
export const WidgetMessageVersion = WIDGET_MESSAGE_VERSION;

const widgetEventEnumTuple = [...WIDGET_RUNTIME_EVENT_LIST] as [
  (typeof WIDGET_RUNTIME_EVENT_LIST)[number],
  ...(typeof WIDGET_RUNTIME_EVENT_LIST)[number][],
];

export const WidgetEventNameSchema = z.enum(widgetEventEnumTuple);

export const WidgetPostMessageSchema = z.object({
  version: z.literal(WIDGET_MESSAGE_VERSION),
  event: WidgetEventNameSchema,
  payload: z.record(z.string(), z.unknown()),
});

export const WidgetRuntimeBootstrapSchema = z.object({
  session_token: z.string().min(20),
  parent_origin: z.string().url().optional(),
});

export const WidgetRuntimePolicySectionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const WidgetRuntimeBootstrapResponseSchema = z.object({
  version: z.literal(WIDGET_MESSAGE_VERSION),
  session: z.object({
    session_id: z.string().uuid(),
    status: z.enum(["ISSUED", "STARTED", "CONSUMED", "EXPIRED", "CANCELLED"]),
    expires_at: z.string(),
    allowed_origin: z.string().url(),
    locale: z.string(),
    purpose_code: z.string(),
    render_hash: z.string(),
    state_reason: z.string().optional(),
  }),
  policy: z.object({
    policy_ref: z.string(),
    policy_version: z.number().int().positive(),
    title: z.string(),
    required_legal_version: z.string(),
    ui_schema_version: z.number().int().positive(),
    sections: z.array(WidgetRuntimePolicySectionSchema),
  }),
});

export type WidgetPostMessage = z.infer<typeof WidgetPostMessageSchema>;
export type WidgetRuntimeBootstrapInput = z.infer<typeof WidgetRuntimeBootstrapSchema>;
export type WidgetRuntimeBootstrapResponse = z.infer<typeof WidgetRuntimeBootstrapResponseSchema>;

import {
  SammatiError,
  WIDGET_EVENTS,
  WIDGET_MESSAGE_VERSION,
  WIDGET_RUNTIME_EVENT_LIST,
  type WidgetEventEnvelope,
  type WidgetRuntimeEvent,
} from "@sammati/shared-core";

export type BuildHostedWidgetUrlInput = Readonly<{
  baseUrl: string;
  sessionToken: string;
}>;

export type MountWidgetIframeInput = Readonly<{
  container: HTMLElement;
  url: string;
  iframeAttrs?: Partial<
    Pick<HTMLIFrameElement, "title" | "loading" | "referrerPolicy" | "allow" | "width" | "height" | "allowFullscreen">
  > & {
    sandbox?: string;
  };
  onResize?: (height: number) => void;
}>;

export type MountedWidget = Readonly<{
  iframe: HTMLIFrameElement;
  dispose: () => void;
}>;

export type CreateWidgetListenerInput = Readonly<{
  allowedOrigin: string;
  onEvent: (event: WidgetEventEnvelope) => void;
}>;

export type WidgetListener = Readonly<{ dispose: () => void }>;

const ALLOWED_EVENTS = new Set<WidgetRuntimeEvent>(WIDGET_RUNTIME_EVENT_LIST);

function parseWidgetEnvelope(raw: unknown): WidgetEventEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<WidgetEventEnvelope>;
  if (candidate.version !== WIDGET_MESSAGE_VERSION) return null;
  if (!candidate.event || !ALLOWED_EVENTS.has(candidate.event as WidgetRuntimeEvent)) return null;
  if (!candidate.payload || typeof candidate.payload !== "object") return null;
  return {
    version: WIDGET_MESSAGE_VERSION,
    event: candidate.event as WidgetRuntimeEvent,
    payload: candidate.payload as Record<string, unknown>,
  };
}

export function buildHostedWidgetUrl(input: BuildHostedWidgetUrlInput): string {
  if (!input.sessionToken || input.sessionToken.trim().length === 0) {
    throw new SammatiError({ type: "validation", message: "sessionToken is required." });
  }
  const url = new URL("/widget/hosted", input.baseUrl);
  url.searchParams.set("session_token", input.sessionToken);
  return url.toString();
}

export function mountWidgetIframe(input: MountWidgetIframeInput): MountedWidget {
  const iframe = document.createElement("iframe");
  iframe.src = input.url;
  iframe.title = input.iframeAttrs?.title ?? "Sammati Consent Widget";
  iframe.referrerPolicy = input.iframeAttrs?.referrerPolicy ?? "strict-origin-when-cross-origin";
  iframe.loading = input.iframeAttrs?.loading ?? "lazy";
  iframe.allow = input.iframeAttrs?.allow ?? "";
  iframe.width = input.iframeAttrs?.width ?? "100%";
  iframe.height = input.iframeAttrs?.height ?? "640";
  iframe.setAttribute(
    "sandbox",
    input.iframeAttrs?.sandbox ?? "allow-scripts allow-forms allow-same-origin",
  );
  iframe.allowFullscreen = input.iframeAttrs?.allowFullscreen ?? false;
  iframe.style.border = "0";
  iframe.style.width = iframe.width;

  input.container.appendChild(iframe);

  const expectedOrigin = new URL(input.url).origin;
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== expectedOrigin) return;
    if (event.source !== iframe.contentWindow) return;
    const parsed = parseWidgetEnvelope(event.data);
    if (!parsed || parsed.event !== WIDGET_EVENTS.resized) return;
    const h = parsed.payload.height;
    if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) return;
    iframe.style.height = `${h}px`;
    input.onResize?.(h);
  };
  window.addEventListener("message", messageHandler);

  return {
    iframe,
    dispose: () => {
      window.removeEventListener("message", messageHandler);
      if (iframe.parentElement === input.container) input.container.removeChild(iframe);
    },
  };
}

export function createWidgetListener(input: CreateWidgetListenerInput): WidgetListener {
  const handler = (event: MessageEvent) => {
    if (event.origin !== input.allowedOrigin) return;
    const parsed = parseWidgetEnvelope(event.data);
    if (!parsed) return;
    input.onEvent(parsed);
  };
  window.addEventListener("message", handler);
  return {
    dispose: () => {
      window.removeEventListener("message", handler);
    },
  };
}

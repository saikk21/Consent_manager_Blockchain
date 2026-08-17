import { describe, expect, it, vi } from "vitest";
import {
  buildHostedWidgetUrl,
  createWidgetListener,
  mountWidgetIframe,
} from "../src/index.js";

describe("widget-sdk helpers", () => {
  it("buildHostedWidgetUrl constructs deterministic safe URL", () => {
    const url = buildHostedWidgetUrl({
      baseUrl: "https://sammati.example.com",
      sessionToken: "abc.def.ghi",
    });
    expect(url).toBe("https://sammati.example.com/widget/hosted?session_token=abc.def.ghi");
  });

  it("mountWidgetIframe creates secure iframe defaults", () => {
    const container = document.createElement("div");
    const mounted = mountWidgetIframe({
      container,
      url: "https://sammati.example.com/widget/hosted?session_token=t",
    });
    expect(container.children.length).toBe(1);
    expect(mounted.iframe.getAttribute("sandbox")).toBe(
      "allow-scripts allow-forms allow-same-origin",
    );
    expect(mounted.iframe.referrerPolicy).toBe("strict-origin-when-cross-origin");
    mounted.dispose();
  });

  it("dispose removes iframe", () => {
    const container = document.createElement("div");
    const mounted = mountWidgetIframe({
      container,
      url: "https://sammati.example.com/widget/hosted?session_token=t",
    });
    expect(container.children.length).toBe(1);
    mounted.dispose();
    expect(container.children.length).toBe(0);
  });

  it("createWidgetListener rejects invalid origin", () => {
    const onEvent = vi.fn();
    const listener = createWidgetListener({
      allowedOrigin: "https://app.example.com",
      onEvent,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.example.com",
        data: { version: "1.0", event: "widget.ready", payload: {} },
      }),
    );
    expect(onEvent).not.toHaveBeenCalled();
    listener.dispose();
  });

  it("createWidgetListener accepts valid schema and origin", () => {
    const onEvent = vi.fn();
    const listener = createWidgetListener({
      allowedOrigin: "https://app.example.com",
      onEvent,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://app.example.com",
        data: { version: "1.0", event: "widget.loaded", payload: { session_id: "s1" } },
      }),
    );
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0]?.[0]?.event).toBe("widget.loaded");
    listener.dispose();
  });

  it("createWidgetListener rejects invalid schema", () => {
    const onEvent = vi.fn();
    const listener = createWidgetListener({
      allowedOrigin: "https://app.example.com",
      onEvent,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://app.example.com",
        data: { version: "2.0", event: "widget.loaded", payload: {} },
      }),
    );
    expect(onEvent).not.toHaveBeenCalled();
    listener.dispose();
  });

  it("mountWidgetIframe handles resize event callback", () => {
    const container = document.createElement("div");
    const onResize = vi.fn();
    const mounted = mountWidgetIframe({
      container,
      url: "https://sammati.example.com/widget/hosted?session_token=t",
      onResize,
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://sammati.example.com",
        source: mounted.iframe.contentWindow,
        data: { version: "1.0", event: "widget.resized", payload: { height: 777 } },
      }),
    );
    expect(onResize).toHaveBeenCalledWith(777);
    expect(mounted.iframe.style.height).toBe("777px");
    mounted.dispose();
  });
});

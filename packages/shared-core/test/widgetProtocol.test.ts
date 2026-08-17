import { describe, expect, it } from "vitest";
import {
  WIDGET_EVENTS,
  WIDGET_MESSAGE_VERSION,
  WIDGET_RUNTIME_EVENT_LIST,
} from "../src/widgetProtocol.js";

describe("widgetProtocol", () => {
  it("keeps wire version", () => {
    expect(WIDGET_MESSAGE_VERSION).toBe("1.0");
  });

  it("lists each event exactly once", () => {
    expect(WIDGET_RUNTIME_EVENT_LIST.length).toBe(6);
    expect(new Set(WIDGET_RUNTIME_EVENT_LIST).size).toBe(6);
  });

  it("object values match list", () => {
    const fromObject = new Set(Object.values(WIDGET_EVENTS));
    expect(fromObject.size).toBe(6);
    for (const e of WIDGET_RUNTIME_EVENT_LIST) {
      expect(fromObject.has(e)).toBe(true);
    }
  });
});

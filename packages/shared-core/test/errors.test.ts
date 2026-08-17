import { describe, expect, it } from "vitest";
import { SammatiError, normalizeUnknownError } from "../src/errors.js";

describe("normalizeUnknownError", () => {
  it("returns same SammatiError instance", () => {
    const err = new SammatiError({ type: "validation", message: "bad request", statusCode: 400 });
    expect(normalizeUnknownError(err)).toBe(err);
  });

  it("normalizes abort errors as timeout", () => {
    const abortErr = new DOMException("aborted", "AbortError");
    const normalized = normalizeUnknownError(abortErr);
    expect(normalized.type).toBe("timeout");
  });
});

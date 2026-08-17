import { SammatiError } from "./errors.js";

export type TimeoutSignalResult = Readonly<{
  signal: AbortSignal;
  cleanup: () => void;
}>;

export function createTimeoutSignal(
  timeoutMs?: number,
  externalSignal?: AbortSignal,
): TimeoutSignalResult {
  if (!timeoutMs && externalSignal) {
    return { signal: externalSignal, cleanup: () => {} };
  }
  if (!timeoutMs) {
    const controller = new AbortController();
    return { signal: controller.signal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    },
  };
}

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new SammatiError({
      type: "timeout",
      message: "Request timed out or was aborted.",
    });
  }
}

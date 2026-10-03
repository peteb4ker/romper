import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKGROUND_FAILURE_MESSAGE,
  installUnhandledRejectionReporter,
} from "../unhandledRejectionReporter";

/** An unhandledrejection event as the browser fires it */
function rejection(reason: unknown) {
  const event = new Event("unhandledrejection", { cancelable: true });
  Object.defineProperty(event, "reason", { value: reason });
  return event;
}

describe("[UC-36] reporting a promise nobody caught (RE-92)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let remove: (() => void) | undefined;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    remove?.();
    remove = undefined;
    consoleError.mockRestore();
  });

  it("shows a message without the reason and logs the reason", () => {
    const report = vi.fn();
    remove = installUnhandledRejectionReporter(report);
    const reason = new Error("SQLITE_BUSY: database is locked");
    const event = rejection(reason);

    globalThis.dispatchEvent(event);

    expect(report).toHaveBeenCalledWith(BACKGROUND_FAILURE_MESSAGE, "error");
    expect(BACKGROUND_FAILURE_MESSAGE).not.toMatch(/SQLITE|Error:/);
    expect(consoleError).toHaveBeenCalledWith(
      "[unhandledrejection] A background task failed:",
      reason,
    );
    // Logged once, by us, not again by the browser
    expect(event.defaultPrevented).toBe(true);
  });

  it("shows one message for a burst, and another after it", () => {
    const report = vi.fn();
    let time = 1000;
    remove = installUnhandledRejectionReporter(report, globalThis, () => time);

    globalThis.dispatchEvent(rejection(new Error("one")));
    time += 100;
    globalThis.dispatchEvent(rejection(new Error("two")));
    globalThis.dispatchEvent(rejection("three"));

    expect(report).toHaveBeenCalledTimes(1);
    // Every one is logged
    expect(consoleError).toHaveBeenCalledTimes(3);

    time += 7000;
    globalThis.dispatchEvent(rejection(new Error("four")));
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("stops reporting once removed", () => {
    const report = vi.fn();
    installUnhandledRejectionReporter(report)();

    globalThis.dispatchEvent(rejection(new Error("late")));

    expect(report).not.toHaveBeenCalled();
  });
});

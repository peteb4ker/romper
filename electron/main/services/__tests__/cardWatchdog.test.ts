import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CARD_NOT_RESPONDING_MESSAGE,
  CardNotRespondingError,
  withCardWatchdog,
} from "../cardWatchdog";

describe("[UC-34] cardWatchdog (#653)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes on an operation's result when it finishes in time", async () => {
    await expect(withCardWatchdog(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("passes on an operation's own failure", async () => {
    await expect(
      withCardWatchdog(Promise.reject(new Error("EIO")), 1000),
    ).rejects.toThrow("EIO");
  });

  it("gives up on an operation that never finishes", async () => {
    vi.useFakeTimers();
    const waiting = withCardWatchdog(new Promise(() => undefined), 60_000);
    const outcome = expect(waiting).rejects.toThrow(CardNotRespondingError);
    await vi.advanceTimersByTimeAsync(60_000);
    await outcome;
    await expect(waiting).rejects.toThrow(CARD_NOT_RESPONDING_MESSAGE);
  });

  it("ignores an abandoned operation's late failure", async () => {
    vi.useFakeTimers();
    let fail: (error: Error) => void = () => undefined;
    const operation = new Promise((_, reject) => {
      fail = reject;
    });
    const waiting = withCardWatchdog(operation, 10);
    const outcome = expect(waiting).rejects.toThrow(CardNotRespondingError);
    await vi.advanceTimersByTimeAsync(10);
    await outcome;
    // Would be an unhandled rejection, failing the run, if it weren't caught
    fail(new Error("EIO"));
    await Promise.resolve();
  });
});

/**
 * A watchdog for SD card operations (#653).
 *
 * A card's file system driver can stop responding: on Pete's card, macOS's
 * FSKit MS-DOS driver hung and an `unlinkat` never returned. Card I/O runs
 * off the main thread (fs.promises, on libuv's thread pool), so the window
 * stays responsive, but an operation that never finishes would leave the
 * write waiting forever. The watchdog gives up on an operation that takes
 * longer than any card should, so the write fails with a message saying
 * the card stopped responding. The operation itself can't be cancelled: a
 * thread blocked in the kernel only returns when the driver does.
 */

/**
 * How long one card operation (writing a file, removing a kit folder) may
 * take. Generous: a 30 MB sample on a slow card takes seconds, not a
 * minute.
 */
export const CARD_OPERATION_TIMEOUT_MS = 60_000;

/** The watchdog's limit; tests shorten it */
export const cardWatchdogSettings = { timeoutMs: CARD_OPERATION_TIMEOUT_MS };

/**
 * Shown when the watchdog gives up. Proposed wording, pending Pete's
 * approval (#653).
 */
export const CARD_NOT_RESPONDING_MESSAGE =
  "The SD card stopped responding, so the write stopped. Eject and reinsert the card, then write again.";

/** A card operation didn't finish within the watchdog's limit */
export class CardNotRespondingError extends Error {
  constructor() {
    super(CARD_NOT_RESPONDING_MESSAGE);
    this.name = "CardNotRespondingError";
  }
}

/**
 * Wait for a card operation, but no longer than `timeoutMs`: past that it
 * rejects with {@link CardNotRespondingError}. The operation keeps running;
 * if it fails later, that failure is ignored.
 */
export async function withCardWatchdog<T>(
  operation: Promise<T>,
  timeoutMs = cardWatchdogSettings.timeoutMs,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CardNotRespondingError()), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
    // A late failure of an abandoned operation isn't anyone's to handle
    operation.catch(() => undefined);
  }
}

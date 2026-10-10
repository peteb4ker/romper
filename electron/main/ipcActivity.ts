import type { IpcChannel } from "@romper/shared/ipcChannels.js";

/**
 * Channels whose calls change the store or the card over a stretch of
 * time: a write, setup (it copies kits into the store), and a rescan (Scan
 * All sends one per kit). The store check doesn't run while one is in
 * flight, and drops what it found if one started meanwhile (#812).
 */
const EXCLUSIVE_CHANNELS: ReadonlySet<IpcChannel> = new Set<IpcChannel>([
  "copy-dir",
  "create-romper-db",
  "download-and-extract-archive",
  "rescan-kit",
  "setup-import-bank-names",
  "setup-import-kit",
  "startKitSync",
]);

/**
 * What the renderer is asking main to do, so background work can give way
 * to it (#812): how many IPC calls are in flight, when the last one began
 * or ended, and whether a write, setup or rescan is among them.
 */
export class IpcActivity {
  /** Whether a write, setup or rescan call is in flight */
  get exclusiveActive(): boolean {
    return this.exclusiveInFlight > 0;
  }
  /**
   * How many write, setup or rescan calls have started. A background step
   * that sees it change knows one began while it worked.
   */
  get exclusiveStartCount(): number {
    return this.exclusiveStarts;
  }
  private exclusiveInFlight = 0;
  private exclusiveStarts = 0;

  private inFlight = 0;

  private lastActivityAt = 0;

  /**
   * Whether no call is in flight and none began or ended for `quietMs`.
   * With `since` (a time), the quiet period counts from it at the earliest.
   */
  isQuiet(quietMs: number, since = 0): boolean {
    return (
      this.inFlight === 0 &&
      Date.now() - Math.max(this.lastActivityAt, since) >= quietMs
    );
  }

  /**
   * Run an IPC handler, counting its call in flight until it settles. The
   * handler's own return value (a promise, or not) is returned as it is.
   */
  track<T>(channel: string, run: () => T): T {
    const exclusive = EXCLUSIVE_CHANNELS.has(channel as IpcChannel);
    this.inFlight++;
    if (exclusive) {
      this.exclusiveInFlight++;
      this.exclusiveStarts++;
    }
    this.lastActivityAt = Date.now();
    const end = () => {
      this.inFlight--;
      if (exclusive) this.exclusiveInFlight--;
      this.lastActivityAt = Date.now();
    };
    let result: T;
    try {
      result = run();
    } catch (error) {
      end();
      throw error;
    }
    if (isThenable(result)) {
      // The caller gets `result` itself; this only learns when it settles
      result.then(end, end);
    } else {
      end();
    }
    return result;
  }
}

/** Every IPC handler registered through `handle` is tracked here */
export const ipcActivity = new IpcActivity();

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

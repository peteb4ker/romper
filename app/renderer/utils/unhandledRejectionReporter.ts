import { createLogger } from "./logger";

const log = createLogger("unhandledrejection");

/** What the user sees when background work fails (RE-92) */
export const BACKGROUND_FAILURE_MESSAGE =
  "Something Romper was doing in the background didn't finish. Check that your last change took effect, and try it again if it didn't.";

// Errors stay on screen this long (useMessageDisplay), so a burst of
// failures shows one message rather than a stack of the same one
const QUIET_MS = 7000;

type RejectionTarget = Pick<
  typeof globalThis,
  "addEventListener" | "removeEventListener"
>;

/**
 * Reports a promise that rejects with nothing to catch it, such as an IPC
 * call nobody awaited (RE-92). The error boundary only sees errors thrown
 * while rendering; these used to reach only the console.
 *
 * Each one is logged with its reason; the user gets one message per burst,
 * without the reason, through `report` (the app's message system).
 *
 * @returns a function that removes the handler.
 */
export function installUnhandledRejectionReporter(
  report: (text: string, type: string) => void,
  target: RejectionTarget = globalThis,
  now: () => number = Date.now,
) {
  let lastShown = Number.NEGATIVE_INFINITY;
  const onRejection = (event: PromiseRejectionEvent) => {
    // Logged here, so Chromium doesn't log it a second time
    event.preventDefault();
    log.error("A background task failed:", event.reason);
    if (now() - lastShown < QUIET_MS) return;
    lastShown = now();
    report(BACKGROUND_FAILURE_MESSAGE, "error");
  };

  target.addEventListener("unhandledrejection", onRejection);
  return () => target.removeEventListener("unhandledrejection", onRejection);
}

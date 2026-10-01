/**
 * Messages every run of the app produces, whatever it does: Chromium's own
 * logging about the machine, the Node inspector Playwright drives main
 * through, and one known Low finding. The full-pipeline validation and the
 * e2e error guard both start from these.
 */
import type { Expectation } from "./collector";

export const BASELINE_EXPECTED: Expectation[] = [
  // Chromium's own logging about the CI machine, not about Romper
  {
    pattern: /:ERROR:dbus\/(bus|object_proxy)\.cc:\d+\]/,
    reason: "Linux CI runners have no D-Bus session for Chromium to connect to",
    sources: ["main-stderr"],
  },
  {
    pattern:
      /:ERROR:sandbox\/mac\/system_services\.cc:\d+\] SetApplicationIsDaemon/,
    reason:
      "Chromium logs this on macOS runners when the app runs as an accessory (hidden window)",
    sources: ["main-stderr"],
  },
  {
    pattern:
      /^(Debugger (listening|ending) on ws:|For help, see: https:\/\/nodejs\.org|Waiting for the debugger to disconnect)/,
    reason: "Playwright drives the main process through the Node inspector",
    sources: ["main-stderr"],
  },
  {
    pattern: /'frame-ancestors' is ignored when delivered via a <meta> element/,
    reason: "frame-ancestors in a <meta> CSP has no effect (register: Low)",
    sources: ["renderer-console"],
  },
];

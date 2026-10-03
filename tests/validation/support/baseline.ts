/**
 * Messages every run of the app produces that a test can't tell from
 * Romper's own: known Low findings. The full-pipeline validation and the
 * e2e error guard both start from these.
 *
 * Main-process stderr from Chromium, the OS or the test harness isn't
 * listed here: `MessageCollector.classify` ignores it through the
 * known-noise list (./known-noise.ts), which has the policy for adding to
 * it.
 */
import type { Expectation } from "./collector";

export const BASELINE_EXPECTED: Expectation[] = [
  {
    pattern: /'frame-ancestors' is ignored when delivered via a <meta> element/,
    reason: "frame-ancestors in a <meta> CSP has no effect (register: Low)",
    sources: ["renderer-console"],
  },
];

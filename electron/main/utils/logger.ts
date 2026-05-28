/**
 * Minimal logger for the Electron main process.
 *
 * Rationale: `console.log` in the main process is useful during development
 * and when diagnosing a packaged build from a terminal, but we do not want
 * chatty startup / ipc trace logs to run in production. Warnings and errors
 * stay unconditional so they remain visible in user-facing diagnostics.
 *
 * Gating is intentionally conservative:
 *   - Logs are emitted when NODE_ENV is "development" or "test".
 *   - Logs are also emitted when ROMPER_DEBUG is truthy, so production
 *     builds can be opted in for one-off troubleshooting.
 *
 * `console.error` and `console.warn` must continue to be called directly
 * in call sites — they are always visible.
 */

function isLoggingEnabled(): boolean {
  if (process.env.ROMPER_DEBUG) return true;
  const env = process.env.NODE_ENV;
  return env === "development" || env === "test" || env === undefined;
}

export const logger = {
  log: (...args: unknown[]): void => {
    if (isLoggingEnabled()) {
      console.log(...args);
    }
  },
};

// The bridge between the integration runner (runner.ts) and the connection
// registry a test file sees.
//
// Vitest loads the runner in its own module graph, so a registry the runner
// imported would be a different copy from the one the test file's database
// code fills: closing it would close nothing. Instead the integration setup
// file (setup.ts), which runs in each test file's own graph, registers that
// file's `closeAllDbConnections` here, and the runner calls it.

const CLOSER = Symbol.for("romper.integration.closeAllDbConnections");

type Closer = () => void;

/**
 * Close every store connection the current test file opened. Throws if the
 * integration setup file didn't register a closer, so a config that loads
 * the runner without the setup file fails loudly rather than leaving
 * connections open.
 */
export function closeRegisteredDbConnections(): void {
  const close = (globalThis as Record<symbol, Closer | undefined>)[CLOSER];
  if (!close) {
    throw new Error(
      "No database connection closer is registered. Add tests/integration/support/setup.ts to the integration setupFiles.",
    );
  }
  close();
}

/** Register the current test file's `closeAllDbConnections` */
export function registerDbConnectionCloser(close: Closer): void {
  (globalThis as Record<symbol, Closer | undefined>)[CLOSER] = close;
}

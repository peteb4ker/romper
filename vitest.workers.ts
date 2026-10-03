import os from "node:os";

/**
 * How many Vitest workers to start (RE-58). A fixed 10 failed with
 * "Timeout waiting for worker to respond" whenever the machine was busy:
 * other sessions testing, Spotlight or Time Machine, or the pre-commit
 * hook's own typecheck, lint and build running alongside the tests.
 *
 * Use the cores that are free now (the core count less the one-minute load
 * average), keep two for the work that runs beside the tests, and never go
 * below one. `ROMPER_TEST_WORKERS` overrides it.
 */
export function testWorkerCount(
  cores = os.availableParallelism(),
  load = os.loadavg()[0],
  override = process.env.ROMPER_TEST_WORKERS,
): number {
  const requested = Number.parseInt(override ?? "", 10);
  if (Number.isInteger(requested) && requested > 0) return requested;

  const free = Math.floor(cores - load);
  return Math.max(1, Math.min(cores - 2, free, 10));
}

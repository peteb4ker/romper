/**
 * IPC counting for e2e performance budgets (tests/perf/budgets.ts).
 *
 * Launch the app with `IPC_PROBE_ARGS` in front of the main script, so the
 * main-process probe (tests/perf/ipc-probe.cjs) wraps every IPC handler from
 * the first one registered. Then `measureIpc` counts the IPC calls one user
 * action makes, by channel.
 */
import type { ElectronApplication } from "@playwright/test";

import path from "node:path";

/** Electron's own preload flag; it ignores NODE_OPTIONS */
export const IPC_PROBE_ARGS = [
  "--require",
  path.resolve("tests/perf/ipc-probe.cjs"),
];

/**
 * Channels left out of the counts, because how often they're called
 * depends on timing, not on the action. `get-favorite-kits-count` runs from
 * an effect on every change to the renderer's `kits` array (useKitFilters).
 * Whether two `setKits` calls after an edit render once or twice depends on
 * whether their IPC replies land in the same task, so a delete made one call
 * locally and two on a loaded CI runner. RE-36 (edits patch instead of
 * reloading) and RE-37 (one favourites path) remove the cause.
 */
export const UNCOUNTED_CHANNELS: readonly string[] = [
  "get-favorite-kits-count",
];

/** No IPC call for this long means the action has settled */
export const IPC_QUIET_MS = 750;

interface Probe {
  count(): number;
  pending(): number;
  reset(): void;
  snapshot(): { calls: { channel: string }[] };
}

/**
 * Reset the probe, run the action, wait until IPC has been quiet for
 * IPC_QUIET_MS, and return the calls it made by channel, plus `total`.
 */
export async function measureIpc(
  app: ElectronApplication,
  run: () => Promise<void>,
): Promise<Record<string, number>> {
  await waitForIpcQuiet(app);
  await app.evaluate(() =>
    (globalThis as unknown as { __romperProbe: Probe }).__romperProbe.reset(),
  );
  await run();
  await waitForIpcQuiet(app);
  return takeIpcCounts(app);
}

/**
 * The calls since the last reset, by channel plus `total`, leaving out
 * UNCOUNTED_CHANNELS; then reset
 */
export async function takeIpcCounts(
  app: ElectronApplication,
): Promise<Record<string, number>> {
  const channels = await app.evaluate(() =>
    (globalThis as unknown as { __romperProbe: Probe }).__romperProbe
      .snapshot()
      .calls.map((call) => call.channel),
  );
  const counted = channels.filter((c) => !UNCOUNTED_CHANNELS.includes(c));
  const counts: Record<string, number> = { total: counted.length };
  for (const channel of counted) counts[channel] = (counts[channel] ?? 0) + 1;
  return counts;
}

/**
 * Wait until main has started no IPC call for IPC_QUIET_MS and none is
 * still running
 */
export async function waitForIpcQuiet(
  app: ElectronApplication,
  limitMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + limitMs;
  let seen = -1;
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    const [count, pending] = await app.evaluate(() => {
      const probe = (globalThis as unknown as { __romperProbe: Probe })
        .__romperProbe;
      return [probe.count(), probe.pending()];
    });
    if (count !== seen || pending > 0) {
      seen = count;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= IPC_QUIET_MS) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`IPC didn't settle within ${limitMs} ms`);
}

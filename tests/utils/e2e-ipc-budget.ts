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
 * depends on timing, not on the action. None are now: the one that was,
 * `get-favorite-kits-count`, ran from an effect on every change to the
 * renderer's `kits` array, and the renderer no longer calls it (RE-37).
 */
export const UNCOUNTED_CHANNELS: readonly string[] = [];

/** No IPC call for this long means the action has settled */
export const IPC_QUIET_MS = 750;

interface Probe {
  count(): number;
  pending(): number;
  reset(): void;
  snapshot(): { calls: { bytes: number; channel: string }[] };
}

/**
 * Reset the probe, run the action, wait until IPC has been quiet for
 * IPC_QUIET_MS, and return the calls it made by channel, plus `total`.
 * `bytesOf` adds a `<channel> bytes` metric for each channel named: the
 * size of what its calls returned.
 */
export async function measureIpc(
  app: ElectronApplication,
  run: () => Promise<void>,
  bytesOf: readonly string[] = [],
): Promise<Record<string, number>> {
  await waitForIpcQuiet(app);
  await app.evaluate(() =>
    (globalThis as unknown as { __romperProbe: Probe }).__romperProbe.reset(),
  );
  await run();
  await waitForIpcQuiet(app);
  return takeIpcCounts(app, bytesOf);
}

/**
 * The calls since the last reset, by channel plus `total`, leaving out
 * UNCOUNTED_CHANNELS, and the bytes returned by each channel in `bytesOf`;
 * then reset
 */
export async function takeIpcCounts(
  app: ElectronApplication,
  bytesOf: readonly string[] = [],
): Promise<Record<string, number>> {
  const calls = await app.evaluate(() =>
    (globalThis as unknown as { __romperProbe: Probe }).__romperProbe
      .snapshot()
      .calls.map(({ bytes, channel }) => ({ bytes, channel })),
  );
  const counted = calls.filter((c) => !UNCOUNTED_CHANNELS.includes(c.channel));
  const counts: Record<string, number> = { total: counted.length };
  for (const channel of bytesOf) counts[`${channel} bytes`] = 0;
  for (const { bytes, channel } of counted) {
    counts[channel] = (counts[channel] ?? 0) + 1;
    if (bytesOf.includes(channel)) counts[`${channel} bytes`] += bytes;
  }
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

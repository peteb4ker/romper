/**
 * Main-process IPC probe, loaded before the app with Electron's
 * `--require <this file>` so it sees every IPC handler from the first one
 * registered. The e2e budgets (tests/utils/e2e-ipc-budget.ts) and the
 * performance profile (tests/validation/performance.validation.ts) use it.
 *
 * It wraps `ipcMain.handle` to time each invoke and keeps the result so its
 * size can be measured later, outside the timed region. An event-loop-delay
 * histogram shows how long the main thread was blocked. The test reads and
 * resets it through `globalThis.__romperProbe` from `app.evaluate`.
 */
const { ipcMain } = require("electron");
const { monitorEventLoopDelay, performance } = require("node:perf_hooks");

const origin = performance.now();
let calls = [];
// Calls started since the last reset, and calls still awaiting their handler
let started = 0;
let pending = 0;
const loop = monitorEventLoopDelay({ resolution: 5 });
loop.enable();

const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
  handle(channel, async (event, ...args) => {
    const start = performance.now();
    started++;
    pending++;
    let running;
    let syncMs;
    try {
      running = listener(event, ...args);
    } finally {
      // Until the handler's first await: time the main thread was held
      syncMs = performance.now() - start;
    }
    let result;
    try {
      result = await running;
    } finally {
      pending--;
    }
    calls.push({
      args: JSON.stringify(args).slice(0, 160),
      at: start - origin,
      channel,
      result,
      syncMs,
      totalMs: performance.now() - start,
    });
    return result;
  });

/** Approximate structured-clone size, in bytes */
function sizeOf(value, seen = new Set()) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return value.length * 2;
  if (typeof value === "number" || typeof value === "boolean") return 8;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer)
    return value.byteLength;
  if (typeof value !== "object" || seen.has(value)) return 0;
  seen.add(value);
  let total = 0;
  for (const [key, item] of Object.entries(value))
    total += key.length * 2 + sizeOf(item, seen);
  return total;
}

globalThis.__romperProbe = {
  /** Calls started since the last reset (a pending call counts) */
  count() {
    return started;
  },
  /** Calls whose handler hasn't finished */
  pending() {
    return pending;
  },
  reset() {
    calls = [];
    started = 0;
    loop.reset();
  },
  snapshot() {
    const out = calls.map(({ result, ...call }) => ({
      ...call,
      bytes: sizeOf(result),
    }));
    const blocking = {
      count: loop.count,
      maxMs: loop.max / 1e6,
      p99Ms: loop.percentile(99) / 1e6,
    };
    calls = [];
    started = 0;
    loop.reset();
    return { blocking, calls: out };
  },
};

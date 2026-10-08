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
 *
 * A blocked main thread isn't always the app's doing: on a loaded machine
 * (a shared CI runner) the OS can leave the thread waiting for a core for
 * hundreds of milliseconds while it has nothing to run (#675). So the probe
 * also times each stall against the main thread's own CPU time: `busy` is
 * the longest stall counting only the time main was running (JavaScript,
 * garbage collection, native work, synchronous file reads from cache). Time
 * spent waiting off-CPU, for a core or for a disk, doesn't count.
 */
const { ipcMain } = require("electron");
const { monitorEventLoopDelay, performance } = require("node:perf_hooks");

/**
 * One invoke, with what its handler returned
 * @typedef {object} ProbeCall
 * @property {string} args the arguments as JSON, cut short
 * @property {number} at ms since the probe loaded
 * @property {string} channel
 * @property {unknown} result
 * @property {number} syncMs until the handler's first await
 * @property {number} totalMs until the handler finished
 */

const origin = performance.now();
/** @type {ProbeCall[]} */
let calls = [];
// Calls started since the last reset, and calls still awaiting their handler
let started = 0;
let pending = 0;
const loop = monitorEventLoopDelay({ resolution: 5 });
loop.enable();

/** Main-thread CPU time (user + system), in ms */
const threadCpuMs = () => {
  const { system, user } = process.threadCpuUsage();
  return (user + system) / 1000;
};
// Each tick that arrives late is a stall; the CPU main used meanwhile says
// how much of it was main's own work rather than waiting for a core
const TICK_MS = 5;
let busyMaxMs = 0;
let lastTick = performance.now();
let lastCpu = threadCpuMs();
setInterval(() => {
  const now = performance.now();
  const cpu = threadCpuMs();
  const lateMs = now - lastTick - TICK_MS;
  if (lateMs > 0)
    busyMaxMs = Math.max(busyMaxMs, Math.min(lateMs, cpu - lastCpu));
  lastTick = now;
  lastCpu = cpu;
}, TICK_MS).unref();

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

/**
 * Approximate structured-clone size, in bytes
 * @param {unknown} value
 * @param {Set<object>} [seen]
 * @returns {number}
 */
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

/** @type {typeof globalThis & { __romperProbe?: object }} */ (
  globalThis
).__romperProbe = {
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
    busyMaxMs = 0;
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
    const busy = { maxMs: busyMaxMs };
    calls = [];
    started = 0;
    busyMaxMs = 0;
    loop.reset();
    return { blocking, busy, calls: out };
  },
};

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "/nonexistent",
    getVersion: () => "0.0.0-test",
    isPackaged: false,
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
}));

import { createRomperDbFile } from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import {
  CARD_NOT_RESPONDING_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../electron/main/services/cardWatchdog.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #714: before a write starts, its IPC handlers check the card's path
// (RE-03). The check resolved the path with synchronous realpath and lstat,
// so on a card whose driver stopped responding (#653) clicking Write again
// blocked the main process and froze the window. The check now resolves
// the path asynchronously, under the card watchdog.

/** The watchdog's limit in these tests: long enough to count turns */
const SHORT_WATCHDOG_MS = 200;

interface HandlerResult {
  error?: string;
  success: boolean;
}

async function invoke(channel: string, ...args: unknown[]) {
  const handler = probe.handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return (await handler({}, ...args)) as HandlerResult;
}

/**
 * Run `call` and count the event-loop turns and timers that ran while it
 * waited: a call that held the main thread would let none through
 */
async function whileCounting<T>(call: () => Promise<T>) {
  let turns = 0;
  let waiting = true;
  const tick = () => {
    if (!waiting) return;
    turns++;
    setImmediate(tick);
  };
  setImmediate(tick);
  let timerFired = false;
  setTimeout(() => {
    timerFired = true;
  }, SHORT_WATCHDOG_MS / 4);

  const started = performance.now();
  const result = await call();
  waiting = false;
  return { elapsed: performance.now() - started, result, timerFired, turns };
}

describe("[UC-34] [Q-01] starting a write on a card that stopped responding (#714)", () => {
  let tempDir: string;
  let sdCardPath: string;
  let realpath: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = createTempStore("card-path-check-");
    const localStorePath = path.join(tempDir, "store");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(localStorePath, { recursive: true });
    fs.mkdirSync(sdCardPath, { recursive: true });
    createRomperDbFile(path.join(localStorePath, ".romperdb"));

    pathAccess.reset();
    probe.handlers.clear();
    registerDbIpcHandlers({ localStorePath, sdCardPath });

    // The card's driver stops responding: resolving any path on it never
    // finishes. Everything else still answers.
    const cardReal = fs.realpathSync.native(sdCardPath);
    const original = fs.promises.realpath;
    realpath = vi
      .spyOn(fs.promises, "realpath")
      .mockImplementation(((p: fs.PathLike, ...rest: unknown[]) =>
        String(p).startsWith(sdCardPath) || String(p).startsWith(cardReal)
          ? new Promise<never>(() => undefined)
          : (original as (...a: unknown[]) => Promise<string>)(
              p,
              ...rest,
            )) as typeof fs.promises.realpath);
    cardWatchdogSettings.timeoutMs = SHORT_WATCHDOG_MS;
  });

  afterEach(() => {
    cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    vi.restoreAllMocks();
    pathAccess.reset();
    removeTempStore(tempDir);
  });

  it("Write says the card stopped responding, and the window stays responsive", async () => {
    const startKitSync = vi.spyOn(syncService, "startKitSync");

    const { elapsed, result, timerFired, turns } = await whileCounting(() =>
      invoke("startKitSync", { sdCardPath }),
    );

    expect(realpath).toHaveBeenCalled();
    expect(result).toEqual({
      error: CARD_NOT_RESPONDING_MESSAGE,
      success: false,
    });
    // It gave up at the watchdog's limit, not the default minute
    expect(elapsed).toBeLessThan(CARD_OPERATION_TIMEOUT_MS);
    // Other work ran while the check waited on the card
    expect(timerFired).toBe(true);
    expect(turns).toBeGreaterThan(10);
    // The write never started
    expect(startKitSync).not.toHaveBeenCalled();
  });

  it("the write summary says the card stopped responding, and the window stays responsive", async () => {
    const generateChangeSummary = vi.spyOn(
      syncService,
      "generateChangeSummary",
    );

    const { result, timerFired, turns } = await whileCounting(() =>
      invoke("generateSyncChangeSummary", sdCardPath),
    );

    expect(result).toEqual({
      error: CARD_NOT_RESPONDING_MESSAGE,
      success: false,
    });
    expect(timerFired).toBe(true);
    expect(turns).toBeGreaterThan(10);
    expect(generateChangeSummary).not.toHaveBeenCalled();
  });

  it("starts the write once the card answers again", async () => {
    const startKitSync = vi
      .spyOn(syncService, "startKitSync")
      .mockResolvedValue({ data: { syncedFiles: 0 }, success: true } as never);
    expect((await invoke("startKitSync", { sdCardPath })).success).toBe(false);

    realpath.mockRestore();
    const result = await invoke("startKitSync", { sdCardPath });

    expect(result.success).toBe(true);
    expect(startKitSync).toHaveBeenCalledTimes(1);
  });
});

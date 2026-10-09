import * as fs from "node:fs";
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
    quit: () => undefined,
  },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showOpenDialog: () => Promise.resolve({ canceled: true }) },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
  shell: { openExternal: () => undefined, showItemInFolder: () => undefined },
}));

// Real fs, with its synchronous calls spied on, so a test can check that
// setup never made one against the card
const SYNC_CALLS = vi.hoisted(
  () =>
    [
      "copyFileSync",
      "existsSync",
      "lstatSync",
      "mkdirSync",
      "openSync",
      "readdirSync",
      "readFileSync",
      "realpathSync",
      "renameSync",
      "rmSync",
      "statfsSync",
      "statSync",
      "unlinkSync",
      "writeFileSync",
    ] as const,
);
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const spied: Record<string, unknown> = { ...actual };
  for (const name of SYNC_CALLS) spied[name] = vi.fn(actual[name]);
  return spied;
});

import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { registerIpcHandlers } from "../../electron/main/ipcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import {
  CARD_NOT_RESPONDING_MESSAGE,
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../electron/main/services/cardWatchdog.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #724: setting up a local store from the card read the card synchronously
// on the main process (listing it, copying each kit, reading the bank name
// files), so on a card whose driver stopped responding (#653) the window
// froze. Each card operation is now asynchronous and under the card
// watchdog: setup stops with the card-not-responding message, and setup's
// cleanup removes what it made.

/**
 * The watchdog's limit once a test's card stops responding: long enough to
 * count turns, and to leave headroom for the real disk operations the same
 * test makes (copying the first sample, resolving the store folder), which
 * the watchdog also times. A busy Windows runner took over 200 ms for one
 * of those, so the watchdog gave up on a folder that isn't on the card
 * (#794).
 */
const SHORT_WATCHDOG_MS = 1000;

type HandlerResult = Record<string, unknown>;

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

  const result = await call();
  waiting = false;
  return { result, timerFired, turns };
}

function writeWav(file: string) {
  fs.writeFileSync(
    file,
    encodeTestWav([sine(220, 0.05, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

const never = <T>() => new Promise<T>(() => undefined);

describe("[UC-01] [Q-01] setting up from a card that stopped responding (#724)", () => {
  let tempDir: string;
  let card: string;
  let cardPaths: string[];
  let target: string;

  /** True if `p` is on the card */
  const onCard = (p: unknown) =>
    cardPaths.some((root) => String(p).startsWith(root));

  /**
   * The card's driver stops responding to `operation`: calls to it on the
   * card (those `when` picks, or all) never finish. Everything else still
   * answers, including resolving card paths for the path check (#714)
   * unless `operation` is realpath. The watchdog gives up after
   * SHORT_WATCHDOG_MS from here on, not the app's minute; a test that
   * hangs nothing keeps the app's limit, so a slow disk can't fail it.
   */
  function hang<
    K extends
      | "copyFile"
      | "lstat"
      | "readdir"
      | "readFile"
      | "realpath"
      | "stat"
      | "statfs",
  >(operation: K, when: (p: string) => boolean = () => true) {
    const original = fs.promises[operation] as (
      ...args: unknown[]
    ) => Promise<unknown>;
    cardWatchdogSettings.timeoutMs = SHORT_WATCHDOG_MS;
    return vi
      .spyOn(fs.promises, operation)
      .mockImplementation(((p: fs.PathLike, ...rest: unknown[]) =>
        onCard(p) && when(String(p))
          ? never()
          : original(p, ...rest)) as never);
  }

  /** The sync fs calls made with a path on the card */
  function syncCallsOnCard() {
    return SYNC_CALLS.flatMap((name) =>
      vi
        .mocked(fs[name] as (...args: unknown[]) => unknown)
        .mock.calls.filter((args) => args.some(onCard))
        .map((args) => `${name}(${String(args[0])})`),
    );
  }

  beforeEach(() => {
    tempDir = createTempStore("setup-hung-card-");
    card = path.join(tempDir, "card");
    target = path.join(tempDir, "store");
    const kit = path.join(card, "A0");
    fs.mkdirSync(kit, { recursive: true });
    writeWav(path.join(kit, "1 KICK.wav"));
    writeWav(path.join(kit, "2 SNARE.wav"));
    fs.writeFileSync(path.join(card, "A - Artist.rtf"), String.raw`{\rtf1}`);
    // The device's own settings, which setup keeps a copy of (#786)
    fs.mkdirSync(path.join(card, "_save"));
    fs.writeFileSync(path.join(card, "_save", "A0.rpl"), "rample");
    fs.mkdirSync(target);
    cardPaths = [card, fs.realpathSync.native(card)];

    pathAccess.reset();
    probe.handlers.clear();
    const settings = { localStorePath: null, sdCardPath: card };
    registerIpcHandlers(settings);
    registerDbIpcHandlers(settings);
    // The folder the user picked for the new store
    pathAccess.grantRoot(target);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    vi.restoreAllMocks();
    pathAccess.reset();
    removeTempStore(tempDir);
  });

  it("listing the card's kits says the card stopped responding, and the window stays responsive", async () => {
    hang("readdir");

    const { result, timerFired, turns } = await whileCounting(() =>
      invoke("list-files-in-root", card),
    );

    expect(result).toEqual({
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      success: false,
    });
    expect(timerFired).toBe(true);
    expect(turns).toBeGreaterThan(10);
  });

  it("copying a kit stops part way, and cleanup leaves nothing of it", async () => {
    // The first sample copies; the card stops responding on the second
    const copyFile = hang("copyFile", (p) => p.endsWith("2 SNARE.wav"));

    const { result, timerFired, turns } = await whileCounting(() =>
      invoke("copy-dir", path.join(card, "A0"), path.join(target, "A0")),
    );

    expect(result).toEqual({
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      success: false,
    });
    expect(timerFired).toBe(true);
    expect(turns).toBeGreaterThan(10);
    expect(copyFile).toHaveBeenCalledTimes(2);
    // Half a kit made it into the store...
    expect(fs.readdirSync(path.join(target, "A0"))).toEqual(["1 KICK.wav"]);

    // ...and setup's cleanup after a failure removes it
    const cleanup = await invoke("cleanup-partial-init", target);
    expect(cleanup).toMatchObject({ removed: true, removedEntries: 1 });
    expect(fs.readdirSync(target)).toEqual([]);
  });

  it("reading the card's bank names says the card stopped responding, and cleanup sets the store aside", async () => {
    const dbDir = path.join(target, ".romperdb");
    expect((await invoke("create-romper-db", dbDir)).success).toBe(true);
    hang("readdir");

    const { result, turns } = await whileCounting(() =>
      invoke("setup-import-bank-names", dbDir, card),
    );

    expect(result).toEqual({
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      success: false,
    });
    expect(turns).toBeGreaterThan(10);

    const cleanup = await invoke("cleanup-partial-init", target);
    expect(cleanup).toMatchObject({ removed: true });
    expect(fs.existsSync(dbDir)).toBe(false);
  });

  it("[Q-04] copying the card's _save folder gives up, and setup carries on (#786)", async () => {
    const dbDir = path.join(target, ".romperdb");
    expect((await invoke("create-romper-db", dbDir)).success).toBe(true);
    const readFile = hang("readFile", (p) => p.includes("_save"));

    const { result, turns } = await whileCounting(() =>
      invoke("setup-backup-rample-save", dbDir, card),
    );

    // Not an error: setup goes on without the copy
    expect(result).toEqual({
      data: {
        cardNotResponding: true,
        error: `Couldn't read the card's _save folder: ${CARD_NOT_RESPONDING_MESSAGE}`,
        status: "failed",
      },
      success: true,
    });
    expect(turns).toBeGreaterThan(10);
    expect(fs.existsSync(path.join(dbDir, "rample-save"))).toBe(false);
    readFile.mockRestore();
    expect(await invoke("setup-import-bank-names", dbDir, card)).toEqual({
      data: { importedBanks: 1 },
      success: true,
    });
  });

  it("the path check on setup's channels says setup stopped (#714)", async () => {
    // Resolving any path on the card never finishes, so the path check in
    // front of each channel gives up
    hang("realpath");
    const copyDir = vi.spyOn(fs.promises, "copyFile");

    const { result, turns } = await whileCounting(() =>
      invoke("list-files-in-root", card),
    );

    const stopped = {
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      success: false,
    };
    expect(result).toEqual(stopped);
    expect(turns).toBeGreaterThan(10);
    expect(
      await invoke("copy-dir", path.join(card, "A0"), path.join(target, "A0")),
    ).toEqual(stopped);
    expect(
      await invoke(
        "setup-import-bank-names",
        path.join(target, ".romperdb"),
        card,
      ),
    ).toEqual(stopped);
    // A store folder typed on the card is refused without asking the user
    expect(
      await invoke("request-local-store-access", path.join(card, "store")),
    ).toEqual({ error: CARD_NOT_RESPONDING_SETUP_MESSAGE, granted: false });
    expect(copyDir).not.toHaveBeenCalled();
  });

  it("the writable and disk space checks say a folder on the card stopped responding", async () => {
    hang("stat");
    hang("statfs");

    expect(await invoke("check-path-writable", card)).toEqual({
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      writable: false,
    });
    expect(await invoke("check-disk-space", card, 1024)).toMatchObject({
      error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
      sufficient: false,
    });
  });

  it("a whole setup from the card touches it only asynchronously", async () => {
    expect(await invoke("check-path-writable", target)).toEqual({
      writable: true,
    });
    expect((await invoke("check-disk-space", target, 1)).sufficient).toBe(true);
    const listed = await invoke("list-files-in-root", card);
    expect(listed).toEqual({
      data: expect.arrayContaining(["A0", "A - Artist.rtf"]),
      success: true,
    });
    expect(
      await invoke("copy-dir", path.join(card, "A0"), path.join(target, "A0")),
    ).toEqual({ success: true });
    const dbDir = path.join(target, ".romperdb");
    expect((await invoke("create-romper-db", dbDir)).success).toBe(true);
    const backup = await invoke("setup-backup-rample-save", dbDir, card);
    expect(backup).toMatchObject({
      data: { files: ["A0.rpl"], status: "copied" },
      success: true,
    });
    expect((await invoke("setup-import-kit", dbDir, "A0")).success).toBe(true);
    expect(await invoke("setup-import-bank-names", dbDir, card)).toEqual({
      data: { importedBanks: 1 },
      success: true,
    });

    expect(syncCallsOnCard()).toEqual([]);
  });
});

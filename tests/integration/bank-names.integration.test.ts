import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the IPC handlers main registers, to call them as the renderer would
const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => os.tmpdir()) },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler),
    ),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

import { getAllBanks } from "../../electron/main/db/romperDbCoreORM.js";
import { createRomperDbFile } from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

type Result = { error?: string; success: boolean };

// RE-23: clearing a bank name deleted its RTF file but kept the name in the
// database, so it came back on reload and was written to the card.
describe("[UC-12] Naming and clearing a bank (RE-23)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let sdCardPath: string;
  let savedEnvPath: string | undefined;

  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({}, ...args) as Promise<Result>;
  const bankA = () =>
    getAllBanks(dbDir).data?.find((bank) => bank.letter === "A");
  const rtfFiles = (dir: string) =>
    fs.readdirSync(dir).filter((file) => file.endsWith(".rtf"));
  /** Every file in the store's root, hidden ones too */
  const storeFiles = () =>
    fs
      .readdirSync(localStorePath)
      .filter((file) => file !== ".romperdb")
      .sort((a, b) => a.localeCompare(b));

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = createTempStore("bank-names-");
    localStorePath = path.join(tempDir, "store");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(localStorePath, { recursive: true });
    fs.mkdirSync(sdCardPath, { recursive: true });
    dbDir = path.join(localStorePath, ".romperdb");
    createRomperDbFile(dbDir);
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
  });

  afterEach(() => {
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    removeTempStore(tempDir);
  });

  it("renames a bank in the database and the local store", async () => {
    expect(
      (await invoke("update-bank", "A", { artist: "ALWIS" })).success,
    ).toBe(true);

    expect(bankA()?.artist).toBe("ALWIS");
    expect(bankA()?.rtf_filename).toBe("A - ALWIS.rtf");
    expect(rtfFiles(localStorePath)).toEqual(["A - ALWIS.rtf"]);
  });

  it("clears the name everywhere", async () => {
    await invoke("update-bank", "A", { artist: "ALWIS" });

    expect((await invoke("update-bank", "A", { artist: null })).success).toBe(
      true,
    );
    expect(bankA()?.artist).toBeNull();
    expect(bankA()?.rtf_filename).toBeNull();
    expect(rtfFiles(localStorePath)).toEqual([]);
  });

  it("treats an empty name as clearing it", async () => {
    await invoke("update-bank", "A", { artist: "ALWIS" });

    await invoke("update-bank", "A", { artist: "  " });

    expect(bankA()?.artist).toBeNull();
    expect(rtfFiles(localStorePath)).toEqual([]);
  });

  it("removes a cleared name from the card at the next write", async () => {
    await invoke("update-bank", "A", { artist: "ALWIS" });
    await syncService.startKitSync({ localStorePath }, { sdCardPath });
    expect(rtfFiles(sdCardPath)).toEqual(["A - ALWIS.rtf"]);

    await invoke("update-bank", "A", { artist: "" });
    const result = await syncService.startKitSync(
      { localStorePath },
      { sdCardPath },
    );

    expect(result.success).toBe(true);
    expect(rtfFiles(sdCardPath)).toEqual([]);
  });

  it("refuses a name that would leave the store, and changes nothing", async () => {
    await invoke("update-bank", "A", { artist: "ALWIS" });

    for (const artist of ["AC/DC", "../../escape", "..\\escape"]) {
      const result = await invoke("update-bank", "A", { artist });
      expect(result.success).toBe(false);
      expect(result.error).toContain("can't contain");
    }

    expect(bankA()?.artist).toBe("ALWIS");
    expect(rtfFiles(localStorePath)).toEqual(["A - ALWIS.rtf"]);
    expect(rtfFiles(tempDir)).toEqual([]);
  });

  it("refuses a bank letter that isn't A to Z", async () => {
    for (const letter of [".*", "a", "AA"]) {
      const result = await invoke("update-bank", letter, { artist: "X" });
      expect(result.success).toBe(false);
    }
    expect(rtfFiles(localStorePath)).toEqual([]);
  });

  // RE-90: the browser read names from the kits, so a bank with no kits
  // lost its name on reload. Main keeps it, and get-all-banks returns it.
  it("keeps the name of a bank with no kits through a reload", async () => {
    await invoke("update-bank", "C", { artist: "Empty Bank" });

    // A reload: main starts again, and the browser loads the kits and the
    // banks
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
    const kits = (await invoke("get-all-kits")) as {
      data?: unknown[];
    } & Result;
    const banks = (await invoke("get-all-banks")) as {
      data?: { artist: null | string; letter: string }[];
    } & Result;

    expect(kits.data).toEqual([]);
    expect(banks.data?.find((bank) => bank.letter === "C")?.artist).toBe(
      "Empty Bank",
    );
  });

  // #567: banks.artist owns the names. The store's name files are written
  // from it, never read back, and change with it or not at all.
  describe("one owner (#567)", () => {
    const banksOnReload = async () => {
      handlers.clear();
      registerDbIpcHandlers({ localStorePath });
      const banks = (await invoke("get-all-banks")) as {
        data?: { artist: null | string; letter: string }[];
      } & Result;
      return Object.fromEntries(
        (banks.data ?? [])
          .filter((bank) => bank.artist)
          .map((bank) => [bank.letter, bank.artist]),
      );
    };

    it("doesn't read a name file put in the store by hand", async () => {
      await invoke("update-bank", "A", { artist: "ALWIS" });
      fs.renameSync(
        path.join(localStorePath, "A - ALWIS.rtf"),
        path.join(localStorePath, "A - Edited.rtf"),
      );
      fs.writeFileSync(path.join(localStorePath, "B - Hand Made.rtf"), "");

      expect(await banksOnReload()).toEqual({ A: "ALWIS" });
    });

    it("renames over a name file, leaving one for the letter and nothing aside", async () => {
      fs.writeFileSync(path.join(localStorePath, "a - Old.rtf"), "");
      fs.writeFileSync(path.join(localStorePath, "A - Older.rtf"), "");

      expect(
        (await invoke("update-bank", "A", { artist: "ALWIS" })).success,
      ).toBe(true);

      expect(storeFiles()).toEqual(["A - ALWIS.rtf"]);
    });

    it("changes neither when the file can't be written", async () => {
      await invoke("update-bank", "A", { artist: "ALWIS" });
      // Something in the way of the new file: a folder by its name
      fs.mkdirSync(path.join(localStorePath, "A - Blocked.rtf"));

      const result = await invoke("update-bank", "A", { artist: "Blocked" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Couldn't save the name of bank A");
      expect(bankA()?.artist).toBe("ALWIS");
      expect(storeFiles()).toEqual(["A - ALWIS.rtf", "A - Blocked.rtf"]);
      expect(
        fs.statSync(path.join(localStorePath, "A - ALWIS.rtf")).isFile(),
      ).toBe(true);
    });

    it("puts the file back when the database refuses the name", async () => {
      await invoke("update-bank", "C", { artist: "Old" });
      const oldFile = path.join(localStorePath, "C - Old.rtf");
      fs.writeFileSync(oldFile, String.raw`{\rtf1 the old file}`);
      // The database refuses any change to bank C: its row is gone
      const sqlite = new Database(path.join(dbDir, "romper.sqlite"));
      try {
        sqlite.prepare("DELETE FROM banks WHERE letter = 'C'").run();
      } finally {
        sqlite.close();
      }

      const renamed = await invoke("update-bank", "C", { artist: "New" });
      const cleared = await invoke("update-bank", "C", { artist: null });

      expect(renamed.success).toBe(false);
      expect(cleared.success).toBe(false);
      expect(storeFiles()).toEqual(["C - Old.rtf"]);
      expect(fs.readFileSync(oldFile, "utf8")).toBe(
        String.raw`{\rtf1 the old file}`,
      );
    });
  });
});

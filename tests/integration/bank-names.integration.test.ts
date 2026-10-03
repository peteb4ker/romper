import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeAllDbConnections } from "../../electron/main/db/utils/dbConnections.js";

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

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bank-names-"));
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
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("renames a bank in the database and the local store", async () => {
    expect(
      (await invoke("update-bank", "A", { artist: "ALWIS" })).success,
    ).toBe(true);

    expect(bankA()?.artist).toBe("ALWIS");
    expect(bankA()?.rtf_filename).toBe("A - ALWIS.rtf");
    expect(rtfFiles(localStorePath)).toEqual(["A - ALWIS.rtf"]);
  });

  it("clears the name everywhere, and a rescan doesn't bring it back", async () => {
    await invoke("update-bank", "A", { artist: "ALWIS" });

    expect((await invoke("update-bank", "A", { artist: null })).success).toBe(
      true,
    );
    expect(bankA()?.artist).toBeNull();
    expect(bankA()?.rtf_filename).toBeNull();
    expect(rtfFiles(localStorePath)).toEqual([]);

    expect((await invoke("scan-banks")).success).toBe(true);
    expect(bankA()?.artist).toBeNull();
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
});

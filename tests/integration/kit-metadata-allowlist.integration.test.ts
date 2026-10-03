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

import {
  addKit,
  createRomperDbFile,
  getKit,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";

type Result = { error?: string; success: boolean };

// RE-22: update-kit-metadata spread the renderer's object into the update,
// so it could rename the kit (orphaning its voices and samples), move it to
// another bank or clear its lock.
describe("[Q-02] Editing a kit's details changes only its alias and editable flag (RE-22)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let savedEnvPath: string | undefined;

  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({}, ...args) as Promise<Result>;

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-metadata-"));
    localStorePath = path.join(tempDir, "store");
    fs.mkdirSync(localStorePath, { recursive: true });
    dbDir = path.join(localStorePath, ".romperdb");
    createRomperDbFile(dbDir);
    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: false,
      locked: true,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
    });
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
  });

  afterEach(() => {
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("saves the alias and the editable flag", async () => {
    const result = await invoke("update-kit-metadata", "A0", {
      alias: "Drums",
      editable: true,
    });

    expect(result.success).toBe(true);
    const kit = getKit(dbDir, "A0").data;
    expect(kit?.alias).toBe("Drums");
    expect(kit?.editable).toBe(true);
  });

  it("refuses to rename the kit, move its bank or clear its lock, and changes nothing", async () => {
    const result = await invoke("update-kit-metadata", "A0", {
      alias: "Drums",
      bank_letter: "B",
      locked: false,
      name: "B9",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Kit details can't change bank_letter, locked, name",
    );
    const kit = getKit(dbDir, "A0").data;
    expect(kit).toBeDefined();
    expect(kit?.alias).toBeNull();
    expect(kit?.bank_letter).toBe("A");
    expect(kit?.locked).toBe(true);
    expect(kit?.voices).toHaveLength(4);
    expect(getKit(dbDir, "B9").data).toBeFalsy();
  });

  it("refuses a value of the wrong type", async () => {
    const result = await invoke("update-kit-metadata", "A0", {
      editable: "yes",
    });

    expect(result).toEqual({
      error: "Kit editable must be true or false",
      success: false,
    });
    expect(getKit(dbDir, "A0").data?.editable).toBe(false);
  });
});

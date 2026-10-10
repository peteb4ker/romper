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

import { addSample } from "../../electron/main/db/operations/sampleCrudOperations.js";
import { addKit } from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

type Result = { error?: string; isValid: boolean };

// The Invalid Local Store dialog refused a good store when one sample file
// was missing, or a kit folder held a WAV the database doesn't list, and
// said nothing about why (#813). It now checks only that the store opens;
// the files are for the store check (#769).
describe("[UC-05] The Invalid Local Store dialog checks only that the store opens (#813)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let savedEnvPath: string | undefined;

  // Main only reads folders Romper has been given, so the store checked is
  // the one the settings name
  const check = (channel: string, storePath = localStorePath) => {
    handlers.clear();
    registerDbIpcHandlers({ localStorePath: storePath });
    return handlers.get(channel)!({}, storePath) as Promise<Result>;
  };

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = createTempStore("store-opens-");
    localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    fs.mkdirSync(path.join(localStorePath, "A0"), { recursive: true });
    createStoreDb(dbDir);
    expect(
      addKit(dbDir, {
        alias: null,
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: null,
      }).success,
    ).toBe(true);
    // One sample the store has, one whose file has gone, and a WAV in the
    // kit folder (an AppleDouble file from a copy off a card) that no row
    // names
    const present = path.join(localStorePath, "A0", "kick.wav");
    fs.writeFileSync(present, "wav");
    fs.writeFileSync(path.join(localStorePath, "A0", "._x.wav"), "apple");
    for (const [voice, file] of [
      [1, present],
      [2, path.join(localStorePath, "A0", "gone.wav")],
    ] as const) {
      expect(
        addSample(dbDir, {
          filename: path.basename(file),
          kit_name: "A0",
          slot_number: 0,
          source_path: file,
          voice_number: voice,
        }).success,
      ).toBe(true);
    }
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    removeTempStore(tempDir);
  });

  it("accepts a store with a missing sample and an extra WAV", async () => {
    expect(await check("validate-local-store-opens")).toEqual({
      isValid: true,
      romperDbPath: path.join(dbDir, "romper.sqlite"),
    });
  });

  it("looks at no sample file", async () => {
    const exists = vi.spyOn(fs, "existsSync");
    const readdir = vi.spyOn(fs, "readdirSync");

    expect((await check("validate-local-store-opens")).isValid).toBe(true);

    const looked = [...exists.mock.calls, ...readdir.mock.calls].map(([p]) =>
      String(p),
    );
    expect(looked.filter((p) => p.includes(path.join("store", "A0")))).toEqual(
      [],
    );
  });

  it("says why when there is no folder", async () => {
    const result = await check(
      "validate-local-store-opens",
      path.join(tempDir, "nowhere"),
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/^Local store path does not exist/);
  });

  it("says why when the folder holds no Romper database", async () => {
    const empty = path.join(tempDir, "empty");
    fs.mkdirSync(empty);
    const result = await check("validate-local-store-opens", empty);
    expect(result).toEqual({
      error:
        "This directory does not contain a valid Romper database (.romperdb folder).",
      isValid: false,
    });
  });

  it("says why when the database file is gone", async () => {
    const noFile = path.join(tempDir, "no-file");
    fs.mkdirSync(path.join(noFile, ".romperdb"), { recursive: true });
    const result = await check("validate-local-store-opens", noFile);
    expect(result).toEqual({
      error: "Romper DB file not found",
      isValid: false,
    });
  });

  it("says why when the database can't be read", async () => {
    const broken = path.join(tempDir, "broken");
    fs.mkdirSync(path.join(broken, ".romperdb"), { recursive: true });
    fs.writeFileSync(
      path.join(broken, ".romperdb", "romper.sqlite"),
      "not a database",
    );
    const result = await check("validate-local-store-opens", broken);
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/^Database schema validation failed: /);
  });

  it("is still the store check's job to report the files", async () => {
    // The Validate Store report keeps its per-kit findings until the store
    // check replaces it (#769)
    const report = (await check("validate-local-store")) as {
      errors?: { extraFiles: string[]; missingFiles: string[] }[];
    } & Result;
    expect(report.isValid).toBe(false);
    expect(report.errors?.[0].missingFiles).toEqual(["gone.wav"]);
  });
});

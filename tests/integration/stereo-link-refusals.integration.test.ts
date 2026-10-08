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
  addSample,
  getKit,
  markKitAsSynced,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { createStoreDb } from "./support/storeDb.js";

type Result = { error?: string; success: boolean };

// #541: main linked any voice the renderer asked it to, so voice 4, or a
// voice whose next voice held samples, could be linked, hiding those
// samples. Main now refuses what the kit editor refuses, in S8's words.
describe("[UC-28] Main refuses a stereo link the kit editor would refuse (#541)", () => {
  let tempDir: string;
  let dbDir: string;
  let savedEnvPath: string | undefined;

  const link = (voiceNumber: number, stereoMode = true) =>
    handlers.get("update-voice-stereo-mode")!(
      {},
      "A0",
      voiceNumber,
      stereoMode,
    ) as Promise<Result>;
  const kit = () => getKit(dbDir, "A0").data!;
  const linked = () =>
    kit()
      .voices!.filter((v) => v.stereo_mode)
      .map((v) => v.voice_number);

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stereo-refusals-"));
    const localStorePath = path.join(tempDir, "store");
    fs.mkdirSync(localStorePath, { recursive: true });
    dbDir = path.join(localStorePath, ".romperdb");
    createStoreDb(dbDir);
    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A0",
    });
    // A snare on voice 2; voices 1, 3 and 4 empty
    addSample(dbDir, {
      filename: "snare.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: path.join(tempDir, "snare.wav"),
      voice_number: 2,
    });
    markKitAsSynced(dbDir, "A0");
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
  });

  afterEach(() => {
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  /** A refusal changes nothing: no link, and nothing new to write */
  function expectUnchanged(linkedBefore: number[]) {
    expect(linked()).toEqual(linkedBefore);
    expect(kit().modified_since_sync).toBe(false);
  }

  it("refuses voice 4", async () => {
    expect(await link(4)).toEqual({
      error: "Voice 4 can't be linked.",
      success: false,
    });
    expectUnchanged([]);
  });

  it("refuses a voice whose next voice has samples", async () => {
    expect(await link(1)).toEqual({
      error: "Voices 1 and 2 can't be linked: voice 2 has samples.",
      success: false,
    });
    expectUnchanged([]);
  });

  it("refuses a voice next to a pair, and the right-hand voice of a pair", async () => {
    expect((await link(2)).success).toBe(true);
    markKitAsSynced(dbDir, "A0");

    expect(await link(1)).toEqual({
      error: "Voices 1 and 2 can't be linked: voice 2 has samples.",
      success: false,
    });
    expect(await link(3)).toEqual({
      error:
        "Voices 3 and 4 can't be linked: voice 3 is already in a stereo pair.",
      success: false,
    });
    expectUnchanged([2]);
  });

  it("links a pair that can be linked, and always allows unlinking", async () => {
    expect(await link(3)).toEqual({ success: true });
    // Linked by hand: the user's choice, so not labelled as automatic
    expect(kit().voices!.find((v) => v.voice_number === 3)).toMatchObject({
      stereo_choice: "stereo",
      stereo_mode: true,
    });
    expect(kit().modified_since_sync).toBe(true);

    // Even with voice 4 now holding a sample, unlinking goes through
    addSample(dbDir, {
      filename: "hat.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: path.join(tempDir, "hat.wav"),
      voice_number: 4,
    });
    expect(await link(3, false)).toEqual({ success: true });
    expect(linked()).toEqual([]);
    // Unlinked by hand: Romper won't link it automatically again (#537)
    expect(kit().voices!.find((v) => v.voice_number === 3)?.stereo_choice).toBe(
      "mono",
    );
  });
});

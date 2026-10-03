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
  createRomperDbFile,
  getKit,
  getKitSamples,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";

type Result = { error?: string; success: boolean };

// RE-25: main had no range or enum checks, so a glitch in the renderer could
// save a volume, gain, tempo or sample mode the Rample can't use, and a
// voice number like 7 or NaN created a stray voice row.
describe("[Q-02] Out-of-range settings are refused and change nothing (RE-25)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let savedEnvPath: string | undefined;

  const invoke = (channel: string, ...args: unknown[]) =>
    handlers.get(channel)!({}, ...args) as Promise<Result>;
  const kit = () => getKit(dbDir, "A0").data!;
  const voice = (n: number) => kit().voices.find((v) => v.voice_number === n)!;
  const gain = () => getKitSamples(dbDir, "A0").data![0].gain_db;

  beforeEach(() => {
    savedEnvPath = process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "setting-ranges-"));
    localStorePath = path.join(tempDir, "store");
    fs.mkdirSync(localStorePath, { recursive: true });
    dbDir = path.join(localStorePath, ".romperdb");
    createRomperDbFile(dbDir);
    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
    });
    addSample(dbDir, {
      filename: "kick.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: path.join(tempDir, "kick.wav"),
      voice_number: 1,
    });
    handlers.clear();
    registerDbIpcHandlers({ localStorePath });
  });

  afterEach(() => {
    if (savedEnvPath === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedEnvPath;
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("saves values inside the Rample's ranges", async () => {
    expect((await invoke("update-voice-volume", "A0", 2, 0)).success).toBe(
      true,
    );
    expect((await invoke("update-sample-gain", "A0", 1, 0, -24)).success).toBe(
      true,
    );
    expect((await invoke("update-kit-bpm", "A0", 180)).success).toBe(true);
    expect(
      (await invoke("update-voice-sample-mode", "A0", 3, "round-robin"))
        .success,
    ).toBe(true);

    expect(voice(2).voice_volume).toBe(0);
    expect(gain()).toBe(-24);
    expect(kit().bpm).toBe(180);
    expect(voice(3).sample_mode).toBe("round-robin");
  });

  it.each([101, -1, 50.5, Number.NaN, "80"])(
    "refuses volume %s",
    async (volume) => {
      const result = await invoke("update-voice-volume", "A0", 1, volume);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Volume must be a whole number/);
      expect(voice(1).voice_volume).toBe(100);
    },
  );

  it.each([12.5, -25, Number.NaN, null])("refuses gain %s", async (gainDb) => {
    const result = await invoke("update-sample-gain", "A0", 1, 0, gainDb);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Gain must be from -24 to \+12 dB/);
    expect(gain()).toBe(0);
  });

  it.each([29, 181, 120.5, Number.NaN])("refuses tempo %s", async (bpm) => {
    const result = await invoke("update-kit-bpm", "A0", bpm);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Tempo must be a whole number/);
    expect(kit().bpm).toBe(120);
  });

  it.each(["loop", "Round-Robin", ""])(
    "refuses sample mode %j",
    async (mode) => {
      const result = await invoke("update-voice-sample-mode", "A0", 1, mode);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Sample mode must be/);
      expect(voice(1).sample_mode).toBe("first");
    },
  );

  it.each([0, 5, 7, 1.5, Number.NaN])(
    "refuses voice %s without creating a voice row",
    async (voiceNumber) => {
      for (const [channel, ...args] of [
        ["update-voice-volume", 50],
        ["update-voice-sample-mode", "random"],
        ["update-voice-alias", "Kick"],
        ["update-voice-stereo-mode", true],
        ["update-voice-slice-settings", { enabled: true }],
        ["update-sample-gain", 0, 1],
      ] as const) {
        const result = await invoke(channel, "A0", voiceNumber, ...args);
        expect(result.success, channel).toBe(false);
        expect(result.error, channel).toMatch(/^Voice must be a whole number/);
      }
      expect(kit().voices).toHaveLength(4);
    },
  );

  it.each([-1, 12, 0.5])("refuses gain on slot %s", async (slot) => {
    const result = await invoke("update-sample-gain", "A0", 1, slot, 3);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Slot must be a whole number/);
  });
});

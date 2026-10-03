import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../services/sampleService.js", () => ({
  sampleService: {
    deleteSampleFromSlotWithoutReindexing: vi.fn(),
    moveSampleBetweenKits: vi.fn(),
    moveSampleInKit: vi.fn(),
    restoreVoices: vi.fn(() => ({ success: true })),
  },
}));

vi.mock("../ipcHandlerUtils.js", () => ({
  createSampleOperationHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../../security/sampleSourceAccess.js", () => ({
  checkSampleSourceAccess: vi.fn(() => ({ ok: true })),
  rememberKitSampleSources: vi.fn(),
}));

import { ipcMain } from "electron";

import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../../security/sampleSourceAccess.js";
import { sampleService } from "../../services/sampleService.js";
import * as ipcHandlerUtils from "../ipcHandlerUtils.js";
import { registerSampleIpcHandlers } from "../sampleIpcHandlers";

const mockIpcMain = vi.mocked(ipcMain);
const mockCreateHandler = vi.mocked(
  ipcHandlerUtils.createSampleOperationHandler,
);

describe("registerSampleIpcHandlers - Unit Tests", () => {
  const mockInMemorySettings = {
    databaseDirectory: "/test/db",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Handler Registration", () => {
    it("[Q-03] should register all 7 sample IPC handlers", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(7);
    });

    it("should register handlers with correct IPC channel names", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      const registeredHandlers = mockIpcMain.handle.mock.calls.map(
        (call) => call[0],
      );

      expect(registeredHandlers).toEqual([
        "add-sample-to-slot",
        "replace-sample-in-slot",
        "delete-sample-from-slot",
        "delete-sample-from-slot-without-reindexing",
        "move-sample-in-kit",
        "move-sample-between-kits",
        "restore-kit-voices",
      ]);
    });

    it("should register all handlers with function callbacks", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      mockIpcMain.handle.mock.calls.forEach((call) => {
        expect(typeof call[1]).toBe("function");
      });
    });
  });

  describe("Handler Factory Usage", () => {
    it("should use createSampleOperationHandler for standard CRUD operations", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      expect(mockCreateHandler).toHaveBeenCalledTimes(3);
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "add",
      );
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "replace",
      );
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "delete",
      );
    });

    it("should pass settings to all handler factory calls", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      mockCreateHandler.mock.calls.forEach((call) => {
        expect(call[0]).toBe(mockInMemorySettings);
      });
    });
  });
});

// Note: The actual handler logic (what happens when handlers are invoked)
// should be tested in integration tests, not unit tests.
// Unit tests should only verify that handlers are registered correctly.

describe("registerSampleIpcHandlers - undo source grants (RE-03)", () => {
  const settings = { localStorePath: "/store" };

  function handlerFor(channel: string) {
    registerSampleIpcHandlers(settings);
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([name]) => name === channel);
    return call![1] as (...args: unknown[]) => unknown;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("remembers the kit's sources before deleting without reindexing", async () => {
    await handlerFor("delete-sample-from-slot-without-reindexing")(
      {},
      "A0",
      1,
      0,
    );
    expect(rememberKitSampleSources).toHaveBeenCalledWith(settings, "A0");
  });

  it("remembers the kit's sources before moving within a kit", async () => {
    await handlerFor("move-sample-in-kit")({}, "A0", 1, 0, 2, 0);
    expect(rememberKitSampleSources).toHaveBeenCalledWith(settings, "A0");
  });

  it("remembers both kits' sources before moving between kits", async () => {
    await handlerFor("move-sample-between-kits")(
      {},
      {
        fromKit: "A0",
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit: "B1",
        toSlot: 0,
        toVoice: 1,
      },
    );
    expect(rememberKitSampleSources).toHaveBeenCalledWith(settings, "A0", "B1");
  });

  describe("[UC-26] [Q-02] restore-kit-voices (RE-86)", () => {
    const voices = [
      {
        samples: [
          {
            filename: "kick.wav",
            gain_db: -6,
            slot_number: 0,
            source_path: "/samples/kick.wav",
            wav_bit_depth: 16,
            wav_bitrate: 705600,
            wav_channels: 1,
            wav_sample_rate: 44100,
          },
        ],
        voice: 1,
      },
    ];
    const restoreHandler = () => {
      registerSampleIpcHandlers(settings);
      const call = mockIpcMain.handle.mock.calls.find(
        ([channel]) => channel === "restore-kit-voices",
      );
      return call![1] as (...args: unknown[]) => Promise<unknown>;
    };

    it("restores through one service call once every file is allowed", async () => {
      const result = await restoreHandler()({}, "A0", voices);

      expect(result).toEqual({ success: true });
      expect(checkSampleSourceAccess).toHaveBeenCalledWith(
        settings,
        "/samples/kick.wav",
      );
      expect(sampleService.restoreVoices).toHaveBeenCalledWith(
        settings,
        "A0",
        voices,
      );
    });

    it("refuses a file Romper may not read, and restores nothing (RE-03)", async () => {
      vi.mocked(checkSampleSourceAccess).mockReturnValueOnce({
        error: "Access denied",
        ok: false,
      });

      const result = await restoreHandler()({}, "A0", voices);

      expect(result).toEqual({ error: "Access denied", success: false });
      expect(sampleService.restoreVoices).not.toHaveBeenCalled();
    });

    it("refuses something that isn't a list of voices", async () => {
      const result = await restoreHandler()({}, "A0", "nope");

      expect(result).toMatchObject({ success: false });
      expect(sampleService.restoreVoices).not.toHaveBeenCalled();
    });
  });
});

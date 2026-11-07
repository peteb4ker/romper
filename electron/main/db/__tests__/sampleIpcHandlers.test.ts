import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("electron", () => ({
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../services/missingFileSearch.js", () => ({
  missingFileSearch: {
    cancel: vi.fn(),
    find: vi.fn(() => Promise.resolve({ success: true })),
    pickFolder: vi.fn(() => Promise.resolve({ data: null, success: true })),
  },
}));

vi.mock("../../services/missingFileRestore.js", () => ({
  restoreMissingFile: vi.fn(() => Promise.resolve({ success: true })),
  undoRestoreMissingFile: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock("../../services/storeCheckService.js", () => ({
  storeCheckService: { recheckKit: vi.fn() },
}));

vi.mock("../../services/sampleService.js", () => ({
  sampleService: {
    moveSampleBetweenKits: vi.fn(),
    moveSampleInKit: vi.fn(),
    restoreVoices: vi.fn(() => ({ success: true })),
  },
}));

vi.mock("../ipcHandlerUtils.js", () => ({
  createSampleOperationHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../../security/sampleSourceAccess.js", () => ({
  checkSampleSourceAccess: vi.fn(() => Promise.resolve({ ok: true })),
  rememberKitSampleSources: vi.fn(() => Promise.resolve()),
}));

import { ipcMain } from "electron";

import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../../security/sampleSourceAccess.js";
import {
  restoreMissingFile,
  undoRestoreMissingFile,
} from "../../services/missingFileRestore.js";
import { missingFileSearch } from "../../services/missingFileSearch.js";
import { sampleService } from "../../services/sampleService.js";
import { storeCheckService } from "../../services/storeCheckService.js";
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
    it("[Q-03] should register all 10 sample IPC handlers", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(10);
    });

    it("should register handlers with correct IPC channel names", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      const registeredHandlers = mockIpcMain.handle.mock.calls.map(
        (call) => call[0],
      );

      expect(registeredHandlers).toEqual([
        "add-sample-to-slot",
        "delete-sample-from-slot",
        "move-sample-in-kit",
        "move-sample-between-kits",
        "restore-kit-voices",
        "remove-missing-samples",
        "pick-search-folder",
        "find-missing-files",
        "cancel-find-missing-files",
        "restore-missing-file",
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

      expect(mockCreateHandler).toHaveBeenCalledTimes(2);
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "add",
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
      vi.mocked(checkSampleSourceAccess).mockResolvedValueOnce({
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

  describe("[UC-05] find missing files (#823)", () => {
    const handlerFor = (channel: string) => {
      registerSampleIpcHandlers({ localStorePath: "/store" });
      const call = mockIpcMain.handle.mock.calls.find((c) => c[0] === channel);
      return call?.[1] as (...args: unknown[]) => Promise<unknown>;
    };

    it("refuses a kit name that isn't one, and a missing store", async () => {
      expect(await handlerFor("pick-search-folder")({}, "")).toEqual({
        error: "Kit name must be a string",
        success: false,
      });
      registerSampleIpcHandlers({});
      const call = mockIpcMain.handle.mock.calls
        .filter((c) => c[0] === "find-missing-files")
        .at(-1);
      expect(
        await (call?.[1] as (...args: unknown[]) => Promise<unknown>)(
          {},
          "A0",
          "/x",
        ),
      ).toEqual({ error: "No local store path configured", success: false });
      expect(await handlerFor("find-missing-files")({}, "A0", "")).toEqual({
        error: "Folder must be a string",
        success: false,
      });
      expect(missingFileSearch.find).not.toHaveBeenCalled();
    });

    it("searches and cancels through the shared search", async () => {
      await handlerFor("pick-search-folder")({}, "A0");
      expect(missingFileSearch.pickFolder).toHaveBeenCalledWith(
        "/store",
        "A0",
        expect.any(Function),
        expect.any(Function),
      );
      await handlerFor("find-missing-files")({}, "A0", "/picked");
      expect(missingFileSearch.find).toHaveBeenCalledWith(
        "/store",
        "A0",
        "/picked",
      );
      await handlerFor("cancel-find-missing-files")({});
      expect(missingFileSearch.cancel).toHaveBeenCalled();
    });

    it("checks the kit again after a restore that worked, not after one that failed", async () => {
      const restore = handlerFor("restore-missing-file");
      await restore({}, "A0", {
        foundPath: "/f.wav",
        kind: "restore",
        sampleId: 3,
      });
      expect(restoreMissingFile).toHaveBeenCalledWith(
        "/store",
        "A0",
        3,
        "/f.wav",
      );
      expect(storeCheckService.recheckKit).toHaveBeenCalledWith("A0");

      vi.mocked(storeCheckService.recheckKit).mockClear();
      const restored = {
        fileName: "f.wav",
        foundPath: "/f.wav",
        kind: "copy",
        path: "/store/A0/f.wav",
        sampleId: 3,
      };
      await restore({}, "A0", { kind: "undo", restored });
      expect(undoRestoreMissingFile).toHaveBeenCalledWith(
        "/store",
        "A0",
        restored,
      );
      expect(storeCheckService.recheckKit).not.toHaveBeenCalled();
    });

    it("refuses a restore request that isn't one", async () => {
      const restore = handlerFor("restore-missing-file");
      for (const request of [
        undefined,
        { kind: "other" },
        { foundPath: "", kind: "restore", sampleId: 1 },
        { kind: "undo", restored: { kind: "repoint", sampleId: 1 } },
        { kind: "undo", restored: { kind: "copy", path: "/a", sampleId: 1.5 } },
      ]) {
        expect(await restore({}, "A0", request)).toMatchObject({
          success: false,
        });
      }
      expect(restoreMissingFile).not.toHaveBeenCalled();
      expect(undoRestoreMissingFile).not.toHaveBeenCalled();
    });
  });
});

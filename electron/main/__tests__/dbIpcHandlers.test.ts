import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock database operations (simple pass-through mocks)
vi.mock("../db/romperDbCoreORM", () => ({
  addKit: vi.fn(),
  addSample: vi.fn(),
  createRomperDbFile: vi.fn(),
  getAllBanks: vi.fn(),
  getKit: vi.fn(),
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
  toggleKitFavorite: vi.fn(),
  updateKit: vi.fn(),
  updateVoiceAlias: vi.fn(),
  updateVoiceStereoMode: vi.fn(() => ({ success: true })),
}));

// Mock services
vi.mock("../services/sampleService.js", () => ({
  sampleService: {
    addSampleToSlot: vi.fn(),
    deleteSampleFromSlot: vi.fn(),
  },
}));

vi.mock("../services/scanService.js", () => ({
  scanService: {
    rescanKit: vi.fn(),
  },
}));

// Mock audio utilities
vi.mock("../audioUtils.js", () => ({
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(() => ({ success: true })),
}));

vi.mock("../services/localStoreService.js", () => ({
  localStoreService: {
    validateLocalStore: vi.fn(() => ({ isValid: true })),
    validateLocalStoreBasic: vi.fn(() => ({ isValid: true })),
  },
}));

// Path authorization is unit-tested in security/__tests__; here it is a
// switch so each guarded channel can be checked allowed and denied.
vi.mock("../security/pathAccess.js", () => ({
  checkPathAccess: vi.fn(() => Promise.resolve({ ok: true })),
  checkSetupDatabaseDirAccess: vi.fn(() => Promise.resolve({ ok: true })),
  checkSetupPathAccess: vi.fn(() => Promise.resolve({ ok: true })),
  pathAccess: { useSettings: vi.fn() },
}));

vi.mock("../security/sampleSourceAccess.js", () => ({
  checkSampleSourceAccess: vi.fn(() => Promise.resolve({ ok: true })),
  rememberKitSampleSources: vi.fn(() => Promise.resolve()),
}));

import { ipcMain } from "electron";

import { getAudioMetadata, validateSampleFormat } from "../audioUtils.js";
import * as romperDbCore from "../db/romperDbCoreORM";
import { registerDbIpcHandlers } from "../dbIpcHandlers";
import {
  checkPathAccess,
  checkSetupDatabaseDirAccess,
  checkSetupPathAccess,
} from "../security/pathAccess.js";
import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../security/sampleSourceAccess.js";
import { localStoreService } from "../services/localStoreService.js";
import { sampleService } from "../services/sampleService.js";
import { scanService } from "../services/scanService.js";

const mockIpcMain = vi.mocked(ipcMain);
const mockSampleService = vi.mocked(sampleService);
const mockScanService = vi.mocked(scanService);
const DENIED = { error: "Access denied: outside granted folders", ok: false };

describe("dbIpcHandlers - Routing Tests", () => {
  let handlerRegistry: Record<string, Function> = {};
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handlerRegistry = {};

    // Capture handler registrations
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: Function) => {
        handlerRegistry[channel] = handler;
      },
    );

    // Set up successful service responses
    mockSampleService.addSampleToSlot.mockReturnValue({
      data: { sampleId: 123 },
      success: true,
    });
    mockSampleService.deleteSampleFromSlot.mockReturnValue({ success: true });
    mockScanService.rescanKit.mockResolvedValue({
      data: {
        addedSamples: 0,
        locked: false,
        metadataUpdated: 0,
        missingSamples: [],
        scannedSamples: 5,
        skippedFiles: [],
        updatedVoices: 2,
      },
      success: true,
    });

    // Mock database operations
    vi.mocked(romperDbCore.createRomperDbFile).mockResolvedValue({
      success: true,
    });
    vi.mocked(romperDbCore.addKit).mockReturnValue({ success: true });
    vi.mocked(romperDbCore.addSample).mockReturnValue({ success: true });
    vi.mocked(romperDbCore.getAllBanks).mockReturnValue({
      data: [],
      success: true,
    });
    vi.mocked(romperDbCore.getKits).mockReturnValue({
      data: [],
      success: true,
    });

    registerDbIpcHandlers(mockInMemorySettings);
  });

  describe("Handler Registration", () => {
    it("registers all expected IPC handlers", () => {
      const expectedHandlers = [
        "create-romper-db",
        "setup-import-kit",
        "get-kit",
        "update-kit-metadata",
        "get-all-kits",
        "update-voice-alias",
        "update-step-pattern",
        "validate-local-store",
        "validate-local-store-basic",
        "get-all-samples-for-kit",
        "rescan-kit",
        // The bank strip loads every bank's name (#512)
        "get-all-banks",
        "add-sample-to-slot",
        "delete-sample-from-slot",
        "validate-sample-format",
      ];

      expectedHandlers.forEach((handler) => {
        expect(handlerRegistry[handler]).toBeDefined();
        expect(typeof handlerRegistry[handler]).toBe("function");
      });
    });

    it("[Q-03] no longer registers channels the renderer stopped using", () => {
      for (const channel of [
        "get-all-samples",
        "get-audio-metadata",
        "get-kits-metadata",
        "rescan-kits-missing-metadata",
        "validate-sample-sources",
      ]) {
        expect(handlerRegistry).not.toHaveProperty(channel);
      }
    });
  });

  describe("Database Operation Handlers", () => {
    it("create-romper-db creates the database through the setup guard", async () => {
      const handler = handlerRegistry["create-romper-db"];
      await handler({}, "/test/path/.romperdb");

      expect(romperDbCore.createRomperDbFile).toHaveBeenCalledWith(
        "/test/path/.romperdb",
      );
    });

    it("setup-import-kit routes to the setup service (RE-34)", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const importSetupKit = vi
        .spyOn(localStoreSetupService, "importSetupKit")
        .mockReturnValue({ success: true });
      await handlerRegistry["setup-import-kit"](
        {},
        "/test/path/.romperdb",
        "A5",
      );

      expect(importSetupKit).toHaveBeenCalledWith("/test/path/.romperdb", "A5");
      importSetupKit.mockRestore();
    });

    // RE-71: linking is an edit, so a read-only kit keeps its stereo setting
    it("update-voice-stereo-mode refuses a kit that isn't editable", async () => {
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: { editable: false, name: "A0" },
        success: true,
      } as ReturnType<typeof romperDbCore.getKit>);
      const result = await handlerRegistry["update-voice-stereo-mode"](
        {},
        "A0",
        1,
        true,
      );
      expect(result).toEqual({
        error:
          "Kit A0 isn't editable. Make it editable to link or unlink voices.",
        success: false,
      });
      expect(romperDbCore.updateVoiceStereoMode).not.toHaveBeenCalled();
    });

    it("update-voice-stereo-mode links voices in an editable kit", async () => {
      vi.mocked(romperDbCore.getKit)
        .mockReturnValueOnce({
          data: { editable: true, name: "A0" },
          success: true,
        } as ReturnType<typeof romperDbCore.getKit>)
        .mockReturnValueOnce({
          data: { editable: true, name: "A0", samples: [] },
          success: true,
        } as unknown as ReturnType<typeof romperDbCore.getKit>);
      const result = await handlerRegistry["update-voice-stereo-mode"](
        {},
        "A0",
        1,
        true,
      );
      expect(romperDbCore.updateVoiceStereoMode).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A0",
        1,
        true,
      );
      // [Q-01] The change returns the kit, without its samples (#452)
      expect(result).toEqual({
        data: { editable: true, name: "A0" },
        success: true,
      });
    });

    it("[Q-01] update-step-pattern returns the kit without its samples, and no kit if it can't be read back (#452)", async () => {
      vi.mocked(romperDbCore.updateKit).mockReturnValue({ success: true });
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: { name: "A0", samples: [], step_pattern: [[1]] },
        success: true,
      } as unknown as ReturnType<typeof romperDbCore.getKit>);
      const handler = handlerRegistry["update-step-pattern"];

      expect(await handler({}, "A0", [[1]])).toEqual({
        data: { name: "A0", step_pattern: [[1]] },
        success: true,
      });

      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        error: "database is locked",
        success: false,
      });
      expect(await handler({}, "A0", [[1]])).toEqual({ success: true });

      vi.mocked(romperDbCore.updateKit).mockReturnValueOnce({
        error: "Kit 'A0' not found",
        success: false,
      });
      expect(await handler({}, "A0", [[1]])).toEqual({
        error: "Kit 'A0' not found",
        success: false,
      });
    });

    it("get-all-kits routes to database with settings validation", async () => {
      const handler = handlerRegistry["get-all-kits"];
      await handler({});

      expect(romperDbCore.getKits).toHaveBeenCalledWith("/test/path/.romperdb");
    });
  });

  describe("Sample Service Handlers", () => {
    it("add-sample-to-slot routes to sampleService.addSampleToSlot", async () => {
      const handler = handlerRegistry["add-sample-to-slot"];
      const result = await handler({}, "TestKit", 1, 0, "/test/file.wav");

      expect(result.success).toBe(true);
      expect(mockSampleService.addSampleToSlot).toHaveBeenCalledWith(
        mockInMemorySettings,
        "TestKit",
        1,
        0,
        "/test/file.wav",
      );
    });

    // #611: replacing a sample won't be built (UC-20); the channel is gone
    it("replace-sample-in-slot is no longer registered", () => {
      expect(handlerRegistry).not.toHaveProperty("replace-sample-in-slot");
    });

    it("delete-sample-from-slot routes to sampleService.deleteSampleFromSlot", async () => {
      vi.mocked(romperDbCore.getKitSamples).mockReturnValueOnce({
        data: [],
        success: true,
      });
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: { name: "TestKit", samples: [] },
        success: true,
      } as unknown as ReturnType<typeof romperDbCore.getKit>);
      const handler = handlerRegistry["delete-sample-from-slot"];
      const result = await handler({}, "TestKit", 3, 7);

      expect(result.success).toBe(true);
      expect(mockSampleService.deleteSampleFromSlot).toHaveBeenCalledWith(
        mockInMemorySettings,
        "TestKit",
        3,
        7,
      );
    });
  });

  describe("Scan Service Handlers", () => {
    it("rescan-kit routes to scanService.rescanKit", async () => {
      const handler = handlerRegistry["rescan-kit"];
      const result = await handler({}, "TestKit");

      expect(result.success).toBe(true);
      expect(mockScanService.rescanKit).toHaveBeenCalledWith(
        mockInMemorySettings,
        "TestKit",
      );
    });

    // #567: the store's bank name files are only written, from banks.artist
    it("has no channel that reads bank names back from the store", () => {
      expect(handlerRegistry["scan-banks"]).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    it("handles missing local store path", async () => {
      // Re-register with empty settings
      registerDbIpcHandlers({ localStorePath: null });

      const handler = handlerRegistry["get-all-kits"];
      const result = await handler({});

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles service errors gracefully", async () => {
      mockSampleService.addSampleToSlot.mockReturnValue({
        error: "Service error",
        success: false,
      });

      const handler = handlerRegistry["add-sample-to-slot"];
      const result = await handler({}, "TestKit", 1, 0, "/test/file.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service error");
    });

    it("validates required parameters for sample operations", async () => {
      const handler = handlerRegistry["add-sample-to-slot"];
      const result = await handler({}, "TestKit", 1, 0); // Missing filePath

      expect(result.success).toBe(false);
      expect(result.error).toBe("File path required for add operation");
    });
  });

  describe("Parameter Passing", () => {
    it("passes all parameters correctly to services", async () => {
      const handler = handlerRegistry["add-sample-to-slot"];
      await handler({}, "MyKit", 4, 11, "/path/to/sample.wav");

      expect(mockSampleService.addSampleToSlot).toHaveBeenCalledWith(
        mockInMemorySettings,
        "MyKit",
        4,
        11,
        "/path/to/sample.wav",
      );
    });

    it("constructs database path correctly from settings", async () => {
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: null,
        success: true,
      });
      const handler = handlerRegistry["get-kit"];
      await handler({}, "A5"); // Fixed: include _event parameter

      expect(romperDbCore.getKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A5",
      );
    });
  });

  describe("[Q-07] get-kit keeps to the contract (#472)", () => {
    it("returns the kit it read", async () => {
      const kit = { name: "A5" };
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: kit,
        success: true,
      } as unknown as ReturnType<typeof romperDbCore.getKit>);

      expect(await handlerRegistry["get-kit"]({}, "A5")).toEqual({
        data: kit,
        success: true,
      });
    });

    it("fails for a kit that isn't there, instead of succeeding with no kit", async () => {
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: null,
        success: true,
      });

      expect(await handlerRegistry["get-kit"]({}, "Z9")).toEqual({
        error: "Kit Z9 not found",
        success: false,
      });
    });

    it("passes on a read that failed", async () => {
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        error: "database is locked",
        success: false,
      });

      expect(await handlerRegistry["get-kit"]({}, "A5")).toEqual({
        error: "database is locked",
        success: false,
      });
    });
  });

  describe("Path authorization (RE-03)", () => {
    it("create-romper-db refuses a database folder outside the roots", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const createSetupDatabase = vi.spyOn(
        localStoreSetupService,
        "createSetupDatabase",
      );
      vi.mocked(checkSetupDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["create-romper-db"](
        {},
        "/Users/me/Library/.romperdb",
      );
      expect(checkSetupDatabaseDirAccess).toHaveBeenCalledWith(
        "/Users/me/Library/.romperdb",
      );
      expect(result).toEqual({ error: DENIED.error, success: false });
      expect(createSetupDatabase).not.toHaveBeenCalled();
      expect(romperDbCore.createRomperDbFile).not.toHaveBeenCalled();
      createSetupDatabase.mockRestore();
    });

    it("setup-import-kit refuses a denied database folder", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const importSetupKit = vi.spyOn(localStoreSetupService, "importSetupKit");
      vi.mocked(checkSetupDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["setup-import-kit"](
        {},
        "/Users/me/Library/.romperdb",
        "A0",
      );
      expect(checkSetupDatabaseDirAccess).toHaveBeenCalledWith(
        "/Users/me/Library/.romperdb",
      );
      expect(result).toEqual({ error: DENIED.error, success: false });
      expect(importSetupKit).not.toHaveBeenCalled();
      importSetupKit.mockRestore();
    });

    it("[UC-01] setup-import-bank-names routes to the setup service (#564)", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const importSetupBankNames = vi
        .spyOn(localStoreSetupService, "importSetupBankNames")
        .mockResolvedValue({ data: { importedBanks: 1 }, success: true });
      const result = await handlerRegistry["setup-import-bank-names"](
        {},
        "/test/path/.romperdb",
        "/Volumes/RAMPLE",
      );
      expect(result).toEqual({ data: { importedBanks: 1 }, success: true });
      expect(importSetupBankNames).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "/Volumes/RAMPLE",
      );
      importSetupBankNames.mockRestore();
    });

    it("setup-import-bank-names refuses a denied database folder or card", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const importSetupBankNames = vi.spyOn(
        localStoreSetupService,
        "importSetupBankNames",
      );
      vi.mocked(checkSetupDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-import-bank-names"](
          {},
          "/Users/me/Library/.romperdb",
          "/Volumes/RAMPLE",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      vi.mocked(checkSetupPathAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-import-bank-names"](
          {},
          "/test/path/.romperdb",
          "/Users/me/Library",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      expect(checkSetupPathAccess).toHaveBeenCalledWith("/Users/me/Library");
      expect(importSetupBankNames).not.toHaveBeenCalled();
      importSetupBankNames.mockRestore();
    });

    it("[UC-01] setup-backup-rample-save routes to the setup service (#786)", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const backup = vi
        .spyOn(localStoreSetupService, "backupSetupRampleSave")
        .mockResolvedValue({ data: { status: "missing" }, success: true });
      const result = await handlerRegistry["setup-backup-rample-save"](
        {},
        "/test/path/.romperdb",
        "/Volumes/RAMPLE",
      );
      expect(result).toEqual({ data: { status: "missing" }, success: true });
      expect(backup).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "/Volumes/RAMPLE",
      );
      backup.mockRestore();
    });

    it("[Q-03] setup-backup-rample-save refuses a denied database folder or card", async () => {
      const { localStoreSetupService } =
        await import("../services/localStoreSetupService.js");
      const backup = vi.spyOn(localStoreSetupService, "backupSetupRampleSave");
      vi.mocked(checkSetupDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-backup-rample-save"](
          {},
          "/Users/me/Library/.romperdb",
          "/Volumes/RAMPLE",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      vi.mocked(checkSetupPathAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-backup-rample-save"](
          {},
          "/test/path/.romperdb",
          "/Users/me/Library",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      expect(checkSetupPathAccess).toHaveBeenCalledWith("/Users/me/Library");
      expect(backup).not.toHaveBeenCalled();
      backup.mockRestore();
    });

    it("[Q-03] get-all-kits reads the configured store, not a renderer path", async () => {
      await handlerRegistry["get-all-kits"]({}, "/attacker/.romperdb");
      expect(romperDbCore.getKits).toHaveBeenCalledWith("/test/path/.romperdb");
    });

    it.each(["validate-local-store", "validate-local-store-basic"])(
      "%s refuses a renderer path outside the roots",
      async (channel) => {
        vi.mocked(checkPathAccess).mockResolvedValueOnce(DENIED);
        const result = await handlerRegistry[channel]({}, "/Users/me");
        expect(checkPathAccess).toHaveBeenCalledWith("/Users/me");
        expect(result).toEqual({ error: DENIED.error, isValid: false });
        expect(localStoreService.validateLocalStore).not.toHaveBeenCalled();
        expect(
          localStoreService.validateLocalStoreBasic,
        ).not.toHaveBeenCalled();
      },
    );

    describe("[Q-07] validate-local-store keeps to the contract (#472)", () => {
      afterEach(() => {
        vi.unstubAllEnvs();
      });

      it.each(["validate-local-store", "validate-local-store-basic"])(
        "%s says no store is set in its result, rather than throwing",
        async (channel) => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "");
          registerDbIpcHandlers({ localStorePath: null });

          await expect(handlerRegistry[channel]({})).resolves.toEqual({
            error: "No local store path provided or configured",
            isValid: false,
          });
        },
      );

      it.each([
        ["validate-local-store", "validateLocalStore"],
        ["validate-local-store-basic", "validateLocalStoreBasic"],
      ] as const)(
        "%s checks the folder it's given, not the ROMPER_LOCAL_PATH store",
        async (channel, method) => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");

          await handlerRegistry[channel]({}, "/picked/store");

          expect(localStoreService[method]).toHaveBeenCalledWith(
            "/picked/store",
          );
        },
      );

      it.each([
        ["validate-local-store", "validateLocalStore"],
        ["validate-local-store-basic", "validateLocalStoreBasic"],
      ] as const)(
        "%s checks the ROMPER_LOCAL_PATH store ahead of the saved one",
        async (channel, method) => {
          vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");

          await handlerRegistry[channel]({});

          expect(localStoreService[method]).toHaveBeenCalledWith("/env/store");
        },
      );
    });

    it("validate-local-store validates an allowed path", async () => {
      const result = await handlerRegistry["validate-local-store"](
        {},
        "/picked/store",
      );
      expect(result).toEqual({ isValid: true });
      expect(localStoreService.validateLocalStore).toHaveBeenCalledWith(
        "/picked/store",
      );
    });

    it("validate-sample-format only reads sample sources the user gave Romper", async () => {
      vi.mocked(checkSampleSourceAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["validate-sample-format"](
        {},
        "/etc/passwd",
      );
      expect(checkSampleSourceAccess).toHaveBeenCalledWith(
        mockInMemorySettings,
        "/etc/passwd",
      );
      expect(result).toEqual({ error: DENIED.error, success: false });
      expect(validateSampleFormat).not.toHaveBeenCalled();
    });

    it("validate-sample-format reads a sample source the user gave Romper", async () => {
      const result = await handlerRegistry["validate-sample-format"](
        {},
        "/picked/kick.wav",
      );
      expect(result).toEqual({ success: true });
      expect(validateSampleFormat).toHaveBeenCalledWith("/picked/kick.wav");
    });

    // [Q-03] get-audio-metadata had the same guard; the channel is gone, so
    // the renderer has no way to ask main for an arbitrary file's header.
    it("[Q-03] get-audio-metadata is no longer registered", () => {
      expect(handlerRegistry).not.toHaveProperty("get-audio-metadata");
      expect(getAudioMetadata).not.toHaveBeenCalled();
    });

    it("add-sample-to-slot refuses a source file the user never gave Romper", async () => {
      vi.mocked(checkSampleSourceAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["add-sample-to-slot"](
        {},
        "A0",
        1,
        0,
        "/Users/me/.ssh/id_rsa",
      );
      expect(result).toEqual({ error: DENIED.error, success: false });
      expect(mockSampleService.addSampleToSlot).not.toHaveBeenCalled();
    });

    it("delete remembers the kit's sources so undo can re-add them", async () => {
      await handlerRegistry["delete-sample-from-slot"]({}, "B1", 1, 0);
      expect(rememberKitSampleSources).toHaveBeenCalledWith(
        mockInMemorySettings,
        "B1",
      );
    });
  });
});

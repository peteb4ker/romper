import { beforeEach, describe, expect, it, vi } from "vitest";

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
    replaceSampleInSlot: vi.fn(),
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
  checkDatabaseDirAccess: vi.fn(() => Promise.resolve({ ok: true })),
  checkPathAccess: vi.fn(() => Promise.resolve({ ok: true })),
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
  checkDatabaseDirAccess,
  checkPathAccess,
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
        return undefined as unknown;
      },
    );

    // Set up successful service responses
    mockSampleService.addSampleToSlot.mockReturnValue({
      data: { sampleId: 123 },
      success: true,
    });
    mockSampleService.replaceSampleInSlot.mockReturnValue({
      data: { sampleId: 456 },
      success: true,
    });
    mockSampleService.deleteSampleFromSlot.mockReturnValue({ success: true });
    mockScanService.rescanKit.mockResolvedValue({
      data: { scannedSamples: 5, updatedVoices: 2 },
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
        "replace-sample-in-slot",
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
      vi.mocked(romperDbCore.getKit).mockReturnValueOnce({
        data: { editable: true, name: "A0" },
        success: true,
      } as ReturnType<typeof romperDbCore.getKit>);
      await handlerRegistry["update-voice-stereo-mode"]({}, "A0", 1, true);
      expect(romperDbCore.updateVoiceStereoMode).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A0",
        1,
        true,
      );
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

    it("replace-sample-in-slot routes to sampleService.replaceSampleInSlot", async () => {
      const handler = handlerRegistry["replace-sample-in-slot"];
      const result = await handler({}, "TestKit", 2, 5, "/test/new.wav");

      expect(result.success).toBe(true);
      expect(mockSampleService.replaceSampleInSlot).toHaveBeenCalledWith(
        mockInMemorySettings,
        "TestKit",
        2,
        5,
        "/test/new.wav",
      );
    });

    it("delete-sample-from-slot routes to sampleService.deleteSampleFromSlot", async () => {
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
      registerDbIpcHandlers({});

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
      const handler = handlerRegistry["get-kit"];
      await handler({}, "A5"); // Fixed: include _event parameter

      expect(romperDbCore.getKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A5",
      );
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
      vi.mocked(checkDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["create-romper-db"](
        {},
        "/Users/me/Library/.romperdb",
      );
      expect(checkDatabaseDirAccess).toHaveBeenCalledWith(
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
      vi.mocked(checkDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      const result = await handlerRegistry["setup-import-kit"](
        {},
        "/Users/me/Library/.romperdb",
        "A0",
      );
      expect(checkDatabaseDirAccess).toHaveBeenCalledWith(
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
        .mockReturnValue({ data: { importedBanks: 1 }, success: true });
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
      vi.mocked(checkDatabaseDirAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-import-bank-names"](
          {},
          "/Users/me/Library/.romperdb",
          "/Volumes/RAMPLE",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      vi.mocked(checkPathAccess).mockResolvedValueOnce(DENIED);
      expect(
        await handlerRegistry["setup-import-bank-names"](
          {},
          "/test/path/.romperdb",
          "/Users/me/Library",
        ),
      ).toEqual({ error: DENIED.error, success: false });
      expect(checkPathAccess).toHaveBeenCalledWith("/Users/me/Library");
      expect(importSetupBankNames).not.toHaveBeenCalled();
      importSetupBankNames.mockRestore();
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

    it.each(["add-sample-to-slot", "replace-sample-in-slot"])(
      "%s refuses a source file the user never gave Romper",
      async (channel) => {
        vi.mocked(checkSampleSourceAccess).mockResolvedValueOnce(DENIED);
        const result = await handlerRegistry[channel](
          {},
          "A0",
          1,
          0,
          "/Users/me/.ssh/id_rsa",
        );
        expect(result).toEqual({ error: DENIED.error, success: false });
        expect(mockSampleService.addSampleToSlot).not.toHaveBeenCalled();
        expect(mockSampleService.replaceSampleInSlot).not.toHaveBeenCalled();
      },
    );

    it("replace and delete remember the kit's sources so undo can re-add them", async () => {
      await handlerRegistry["replace-sample-in-slot"](
        {},
        "A0",
        1,
        0,
        "/new.wav",
      );
      await handlerRegistry["delete-sample-from-slot"]({}, "B1", 1, 0);
      expect(rememberKitSampleSources).toHaveBeenCalledWith(
        mockInMemorySettings,
        "A0",
      );
      expect(rememberKitSampleSources).toHaveBeenCalledWith(
        mockInMemorySettings,
        "B1",
      );
    });
  });
});

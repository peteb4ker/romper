import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock database operations (simple pass-through mocks)
vi.mock("../db/romperDbCoreORM", () => ({
  createRomperDbFile: vi.fn(),
  addKit: vi.fn(),
  addSample: vi.fn(),
  getAllBanks: vi.fn(),
  getAllSamples: vi.fn(),
  getKit: vi.fn(),
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
  updateKit: vi.fn(),
  updateVoiceAlias: vi.fn(),
  toggleKitFavorite: vi.fn(),
  setKitFavorite: vi.fn(),
  getFavoriteKits: vi.fn(),
  getFavoriteKitsCount: vi.fn(),
}));

// Mock services
vi.mock("../services/sampleService.js", () => ({
  sampleService: {
    addSampleToSlot: vi.fn(),
    replaceSampleInSlot: vi.fn(),
    deleteSampleFromSlot: vi.fn(),
    validateSampleSources: vi.fn(),
  },
}));

vi.mock("../services/scanService.js", () => ({
  scanService: {
    rescanKit: vi.fn(),
    scanBanks: vi.fn(),
  },
}));

import { ipcMain } from "electron";

import * as romperDbCore from "../db/romperDbCoreORM";
import { registerDbIpcHandlers } from "../dbIpcHandlers";
import { sampleService } from "../services/sampleService.js";
import { scanService } from "../services/scanService.js";

const mockIpcMain = vi.mocked(ipcMain);
const mockSampleService = vi.mocked(sampleService);
const mockScanService = vi.mocked(scanService);

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
        return undefined as any;
      },
    );

    // Set up successful service responses
    mockSampleService.addSampleToSlot.mockReturnValue({
      success: true,
      data: { sampleId: 123 },
    });
    mockSampleService.replaceSampleInSlot.mockReturnValue({
      success: true,
      data: { sampleId: 456 },
    });
    mockSampleService.deleteSampleFromSlot.mockReturnValue({ success: true });
    mockSampleService.validateSampleSources.mockReturnValue({
      success: true,
      data: { totalSamples: 0, validSamples: 0, invalidSamples: [] },
    });
    mockScanService.rescanKit.mockResolvedValue({
      success: true,
      data: { scannedSamples: 5, updatedVoices: 2 },
    });
    mockScanService.scanBanks.mockResolvedValue({
      success: true,
      data: { scannedFiles: 3, updatedBanks: 3, scannedAt: new Date() },
    });

    // Mock database operations
    vi.mocked(romperDbCore.createRomperDbFile).mockResolvedValue({
      success: true,
    });
    vi.mocked(romperDbCore.addKit).mockReturnValue({ success: true });
    vi.mocked(romperDbCore.addSample).mockReturnValue({ success: true });
    vi.mocked(romperDbCore.getAllBanks).mockReturnValue({
      success: true,
      data: [],
    });
    vi.mocked(romperDbCore.getKits).mockReturnValue({
      success: true,
      data: [],
    });

    registerDbIpcHandlers(mockInMemorySettings);
  });

  describe("Handler Registration", () => {
    it("registers all expected IPC handlers", () => {
      const expectedHandlers = [
        "create-romper-db",
        "insert-kit",
        "insert-sample",
        "get-kit",
        "update-kit-metadata",
        "get-all-kits",
        "update-voice-alias",
        "update-step-pattern",
        "validate-local-store",
        "validate-local-store-basic",
        "get-all-samples",
        "get-all-samples-for-kit",
        "rescan-kit",
        "delete-all-samples-for-kit",
        "get-all-banks",
        "scan-banks",
        "add-sample-to-slot",
        "replace-sample-in-slot",
        "delete-sample-from-slot",
        "validate-sample-sources",
      ];

      expectedHandlers.forEach((handler) => {
        expect(handlerRegistry[handler]).toBeDefined();
        expect(typeof handlerRegistry[handler]).toBe("function");
      });
    });
  });

  describe("Database Operation Handlers", () => {
    it("create-romper-db routes to createRomperDbFile", async () => {
      const handler = handlerRegistry["create-romper-db"];
      await handler({}, "/test/db");

      expect(romperDbCore.createRomperDbFile).toHaveBeenCalledWith("/test/db");
    });

    it("insert-kit routes to addKit", async () => {
      const handler = handlerRegistry["insert-kit"];
      const kit = { name: "A5", bank_letter: "A" };
      await handler({}, "/test/db", kit);

      expect(romperDbCore.addKit).toHaveBeenCalledWith("/test/db", kit);
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
        undefined,
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
        undefined,
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

    it("validate-sample-sources routes to sampleService.validateSampleSources", async () => {
      const handler = handlerRegistry["validate-sample-sources"];
      const result = await handler({}, "TestKit");

      expect(result.success).toBe(true);
      expect(mockSampleService.validateSampleSources).toHaveBeenCalledWith(
        mockInMemorySettings,
        "TestKit",
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

    it("scan-banks routes to scanService.scanBanks", async () => {
      const handler = handlerRegistry["scan-banks"];
      const result = await handler({});

      expect(result.success).toBe(true);
      expect(mockScanService.scanBanks).toHaveBeenCalledWith(
        mockInMemorySettings,
      );
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
        success: false,
        error: "Service error",
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
        undefined,
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
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Electron modules
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
}));

// Mock filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({
    isDirectory: () => false,
    isFile: () => true,
    size: 1024,
  })),
}));

// Mock the sync service
const mockSyncService = {
  generateChangeSummary: vi.fn(),
  startKitSync: vi.fn(),
};

vi.mock("../../electron/main/services/syncService.js", () => ({
  syncService: mockSyncService,
}));

describe("Sync IPC Integration Tests", () => {
  let ipcMain: any;
  let dialog: any;
  let registerSyncIpcHandlers: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import modules after clearing mocks
    ({ dialog, ipcMain } = await import("electron"));
    ({ registerSyncIpcHandlers } = await import(
      "../../electron/main/db/syncIpcHandlers"
    ));

    // Reset mock implementations
    mockSyncService.generateChangeSummary.mockResolvedValue({
      data: {
        estimatedSize: 1024000,
        estimatedTime: 30,
        filesToConvert: [],
        filesToCopy: [
          {
            destinationPath: "/sd/A0/1sample1.wav",
            filename: "1sample1.wav",
            operation: "copy",
            sourcePath: "/local/A0/kick.wav",
          },
        ],
        hasFormatWarnings: false,
        validationErrors: [],
        warnings: [],
      },
      success: true,
    });

    mockSyncService.startKitSync.mockResolvedValue({
      data: { syncedFiles: 1 },
      success: true,
    });

    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/Users/test/Downloads"],
    });
  });

  describe("IPC Handler Registration", () => {
    it("should register all sync-related IPC handlers", async () => {
      registerSyncIpcHandlers({});

      // Verify all expected handlers are registered
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "generateSyncChangeSummary",
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "startKitSync",
        expect.any(Function),
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        "cancelKitSync",
        expect.any(Function),
      );
    });
  });

  describe("generateSyncChangeSummary IPC Handler", () => {
    it("should generate sync change summary successfully", async () => {
      registerSyncIpcHandlers({});

      // Get the registered handler
      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      );
      expect(handlerCall).toBeDefined();

      const handler = handlerCall[1];
      const mockEvent = {};
      const mockSettings = { localStorePath: "/local/store" };

      const result = await handler(mockEvent, mockSettings);

      expect(mockSyncService.generateChangeSummary).toHaveBeenCalledWith(
        {},
        mockSettings,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("filesToCopy");
      expect(result.data).toHaveProperty("estimatedSize");
    });

    it("should handle generate sync change summary errors", async () => {
      mockSyncService.generateChangeSummary.mockResolvedValue({
        error: "Failed to read local store",
        success: false,
      });

      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      );
      const handler = handlerCall[1];
      const result = await handler({}, { localStorePath: "/invalid" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to read local store");
    });

    it("should handle missing settings", async () => {
      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      );
      const handler = handlerCall[1];
      await handler({}, null);

      expect(mockSyncService.generateChangeSummary).toHaveBeenCalledWith(
        {},
        null,
      );
    });
  });

  describe("startKitSync IPC Handler", () => {
    it("should start kit sync successfully", async () => {
      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      );
      expect(handlerCall).toBeDefined();

      const handler = handlerCall[1];
      const mockEvent = {};
      const mockSyncRequest = {
        sdCardPath: "/sd/card",
        wipeSdCard: false,
      };

      const result = await handler(mockEvent, mockSyncRequest);

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        {
          sdCardPath: "/sd/card",
          wipeSdCard: false,
        },
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("syncedFiles");
    });

    it("should handle start kit sync errors", async () => {
      mockSyncService.startKitSync.mockResolvedValue({
        error: "SD card not found",
        success: false,
      });

      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      );
      const handler = handlerCall[1];
      const result = await handler(
        {},
        {
          sdCardPath: "/nonexistent",
          wipeSdCard: false,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("SD card not found");
    });

    it("should handle wipe SD card option", async () => {
      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      );
      const handler = handlerCall[1];
      const result = await handler(
        {},
        {
          sdCardPath: "/sd/card",
          wipeSdCard: true,
        },
      );

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        {
          sdCardPath: "/sd/card",
          wipeSdCard: true,
        },
      );
      expect(result.success).toBe(true);
    });

    it("should handle invalid sync request", async () => {
      registerSyncIpcHandlers({});

      const handlerCall = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      );
      const handler = handlerCall[1];

      // Test with missing sdCardPath
      await handler(
        {},
        {
          wipeSdCard: false,
        },
      );

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        {
          wipeSdCard: false,
        },
      );
    });
  });

  describe("Complete Sync Workflow Integration", () => {
    it("should handle complete sync workflow from renderer to main", async () => {
      registerSyncIpcHandlers({});

      // Step 1: Generate change summary
      const generateSummaryHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      )[1];

      const settings = { localStorePath: "/local/store" };
      const summaryResult = await generateSummaryHandler({}, settings);

      expect(summaryResult.success).toBe(true);
      expect(summaryResult.data.filesToCopy).toHaveLength(1);

      // Step 2: Start sync
      const startSyncHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      )[1];

      const syncRequest = {
        sdCardPath: "/sd/card",
        wipeSdCard: false,
      };

      const syncResult = await startSyncHandler({}, syncRequest);
      expect(syncResult.success).toBe(true);
      expect(syncResult.data.syncedFiles).toBe(1);

      // Verify all services were called correctly
      expect(mockSyncService.generateChangeSummary).toHaveBeenCalledWith(
        {},
        settings,
      );
      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        syncRequest,
      );
    });

    it("should handle workflow with wipe SD card enabled", async () => {
      registerSyncIpcHandlers({});

      const generateSummaryHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      )[1];
      const startSyncHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      )[1];

      // Generate summary
      const settings = { localStorePath: "/local/store" };
      await generateSummaryHandler({}, settings);

      // Start sync with wipe enabled
      const syncRequest = {
        sdCardPath: "/sd/card",
        wipeSdCard: true,
      };

      const syncResult = await startSyncHandler({}, syncRequest);
      expect(syncResult.success).toBe(true);

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        {
          sdCardPath: "/sd/card",
          wipeSdCard: true,
        },
      );
    });

    it("should handle error propagation through IPC chain", async () => {
      // Mock a failure in generateChangeSummary
      mockSyncService.generateChangeSummary.mockResolvedValue({
        error: "Local store corrupted",
        success: false,
      });

      registerSyncIpcHandlers({});

      const generateSummaryHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      )[1];

      const result = await generateSummaryHandler(
        {},
        { localStorePath: "/corrupt" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Local store corrupted");

      // Subsequent sync should not be called if summary fails
      const startSyncHandler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      )[1];

      // Even if sync is attempted, it should handle the missing data gracefully
      await startSyncHandler(
        {},
        {
          sdCardPath: "/sd/card",
          wipeSdCard: false,
        },
      );

      // Service should still be called, but may fail due to lack of valid data
      expect(mockSyncService.startKitSync).toHaveBeenCalled();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle IPC communication errors", async () => {
      mockSyncService.generateChangeSummary.mockRejectedValue(
        new Error("Service crashed"),
      );

      registerSyncIpcHandlers({});

      const handler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      )[1];

      try {
        await handler({}, { localStorePath: "/test" });
        expect.fail("Expected handler to throw an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Service crashed");
      }
    });

    it("should handle malformed IPC requests", async () => {
      registerSyncIpcHandlers({});

      const handler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "startKitSync",
      )[1];

      // Test with undefined request
      await handler({}, undefined);

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith({}, undefined);
    });

    it("should handle concurrent IPC requests", async () => {
      registerSyncIpcHandlers({});

      const handler = ipcMain.handle.mock.calls.find(
        (call) => call[0] === "generateSyncChangeSummary",
      )[1];

      // Simulate concurrent requests
      const promises = [
        handler({}, { localStorePath: "/store1" }),
        handler({}, { localStorePath: "/store2" }),
        handler({}, { localStorePath: "/store3" }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      expect(mockSyncService.generateChangeSummary).toHaveBeenCalledTimes(3);
    });
  });
});

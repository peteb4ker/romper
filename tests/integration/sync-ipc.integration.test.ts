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

// Mock filesystem (keeping the real realpath/lstat that path authorization
// uses to resolve the SD card path)
vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fs")>()),
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

type Handler = (event: object, arg?: unknown) => Promise<HandlerResult>;
/** What the sync handlers resolve with, as far as these tests read it */
interface HandlerResult {
  data?: { filesToCopy?: unknown[]; syncedFiles?: number };
  error?: string;
  success: boolean;
}

describe("Sync IPC Integration Tests", () => {
  let ipcMain: typeof import("electron").ipcMain;
  let dialog: typeof import("electron").dialog;
  let registerSyncIpcHandlers: typeof import("../../electron/main/db/syncIpcHandlers").registerSyncIpcHandlers;

  /** The handler registered for a channel; fails the test if there's none */
  function handlerFor(channel: string): Handler {
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([name]) => name === channel);
    expect(call).toBeDefined();
    return call?.[1] as unknown as Handler;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // RE-03: startKitSync only writes to an SD card folder main has granted
    // (settings, env, or a folder picked in the dialog this session).
    const { pathAccess } =
      await import("../../electron/main/security/pathAccess");
    pathAccess.reset();
    pathAccess.grantRoot("/sd/card");
    pathAccess.grantRoot("/nonexistent");

    // Import modules after clearing mocks
    ({ dialog, ipcMain } = await import("electron"));
    ({ registerSyncIpcHandlers } =
      await import("../../electron/main/db/syncIpcHandlers"));

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

    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
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
      const handler = handlerFor("generateSyncChangeSummary");
      const mockEvent = {};
      const mockSettings = "/sd/card";

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

      const handler = handlerFor("generateSyncChangeSummary");
      const result = await handler({}, "/sd/card");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to read local store");
    });

    it("should handle missing settings", async () => {
      registerSyncIpcHandlers({});

      const handler = handlerFor("generateSyncChangeSummary");
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

      const handler = handlerFor("startKitSync");
      const mockEvent = {};
      const mockSyncRequest = {
        sdCardPath: "/sd/card",
      };

      const result = await handler(mockEvent, mockSyncRequest);

      expect(mockSyncService.startKitSync).toHaveBeenCalledWith(
        {},
        {
          sdCardPath: "/sd/card",
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

      const handler = handlerFor("startKitSync");
      const result = await handler(
        {},
        {
          sdCardPath: "/nonexistent",
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("SD card not found");
    });

    it("should handle invalid sync request", async () => {
      registerSyncIpcHandlers({});

      const handler = handlerFor("startKitSync");

      // Test with missing sdCardPath: refused before the sync service runs
      const result = await handler({}, {});

      expect(result.success).toBe(false);
      expect(mockSyncService.startKitSync).not.toHaveBeenCalled();
    });

    it("should refuse an SD card folder Romper was never given (RE-03)", async () => {
      registerSyncIpcHandlers({});

      const handler = handlerFor("startKitSync");

      const result = await handler(
        {},
        { sdCardPath: "/Users/test/Library/LaunchAgents" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Access denied/);
      expect(mockSyncService.startKitSync).not.toHaveBeenCalled();
    });
  });

  describe("Complete Sync Workflow Integration", () => {
    it("should handle complete sync workflow from renderer to main", async () => {
      registerSyncIpcHandlers({});

      // Step 1: Generate change summary
      const generateSummaryHandler = handlerFor("generateSyncChangeSummary");

      const settings = "/sd/card";
      const summaryResult = await generateSummaryHandler({}, settings);

      expect(summaryResult.success).toBe(true);
      expect(summaryResult.data?.filesToCopy).toHaveLength(1);

      // Step 2: Start sync
      const startSyncHandler = handlerFor("startKitSync");

      const syncRequest = {
        sdCardPath: "/sd/card",
      };

      const syncResult = await startSyncHandler({}, syncRequest);
      expect(syncResult.success).toBe(true);
      expect(syncResult.data?.syncedFiles).toBe(1);

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

    it("should handle error propagation through IPC chain", async () => {
      // Mock a failure in generateChangeSummary
      mockSyncService.generateChangeSummary.mockResolvedValue({
        error: "Local store corrupted",
        success: false,
      });

      registerSyncIpcHandlers({});

      const generateSummaryHandler = handlerFor("generateSyncChangeSummary");

      const result = await generateSummaryHandler({}, "/sd/card");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Local store corrupted");

      // Subsequent sync should not be called if summary fails
      const startSyncHandler = handlerFor("startKitSync");

      // Even if sync is attempted, it should handle the missing data gracefully
      await startSyncHandler(
        {},
        {
          sdCardPath: "/sd/card",
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

      const handler = handlerFor("generateSyncChangeSummary");

      try {
        await handler({}, "/sd/card");
        expect.fail("Expected handler to throw an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Service crashed");
      }
    });

    it("should handle malformed IPC requests", async () => {
      registerSyncIpcHandlers({});

      const handler = handlerFor("startKitSync");

      // Test with undefined request: refused before the sync service runs
      const result = await handler({}, undefined);

      expect(result.success).toBe(false);
      expect(mockSyncService.startKitSync).not.toHaveBeenCalled();
    });

    it("should handle concurrent IPC requests", async () => {
      registerSyncIpcHandlers({});

      const handler = handlerFor("generateSyncChangeSummary");

      // Simulate concurrent requests
      const promises = [
        handler({}, "/sd/card"),
        handler({}, "/sd/card"),
        handler({}, "/sd/card"),
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

import type {
  KitScanResult,
  KitScanSkippedFile,
} from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalStoreWizard } from "../useLocalStoreWizard";

/** What main's setup import returns, with the given skipped files */
function importResult(skippedFiles: KitScanSkippedFile[]): KitScanResult {
  return {
    addedSamples: 12,
    locked: false,
    metadataUpdated: 0,
    missingSamples: [],
    scannedSamples: 12 + skippedFiles.length,
    skippedFiles,
    updatedVoices: 1,
  };
}

// Replace all usage of waitFor with manual polling for async state
function waitForAsync(fn: () => boolean, timeout = 1000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (fn()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("timeout"));
      setTimeout(check, 10);
    }
    check();
  });
}

describe("useLocalStoreWizard", () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Set up scanner mock with default successful response

    // DRY: Always mock all required electronAPI methods for all tests
    vi.mocked(window.electronAPI.createRomperDb).mockImplementation(
      async (dbDir: string) => ({
        dbPath: dbDir + "/romper.sqlite",
        success: true,
      }),
    );
    vi.mocked(window.electronAPI.ensureDir).mockResolvedValue(true);
    vi.mocked(window.electronAPI.getSetting).mockImplementation(async (key) => {
      if (key === "localStorePath") return "/mock/saved/path/romper";
      return undefined;
    });
    vi.mocked(window.electronAPI.setSetting).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir, _onProgress, _onError) => ({ success: true }),
    );
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (_path) => [],
    );
    vi.mocked(window.electronAPI.copyDir).mockImplementation(
      async (_src, _dest) => {},
    );
    vi.mocked(window.electronAPI.setupImportKit).mockImplementation(
      async () => ({ data: importResult([]), success: true }),
    );
    vi.mocked(window.electronAPI.updateKit).mockImplementation(
      async (_dbDir, _kitName, _updates) => ({
        success: true,
      }),
    );
    vi.mocked(window.electronAPI.updateVoiceAlias).mockImplementation(
      async (_kitName, _voiceNumber, _voiceAlias) => ({
        success: true,
      }),
    );
    vi.mocked(window.electronAPI.readFile).mockImplementation(
      async (_filePath) => ({
        data: new ArrayBuffer(1024),
        success: true,
      }),
    );
  });

  it("initializes with default state and loads defaultPath async", async () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    expect(result.current.state).toMatchObject({
      error: null,
      isInitializing: false,
      sdCardMounted: false,
      source: null,
      targetPath: "",
    });
    await waitForAsync(() => result.current.defaultPath !== "");
    expect(result.current.defaultPath).toContain("romper");
    // targetPath is not set on mount anymore
    expect(result.current.state.targetPath).toBe("");
  });

  it("sets target path", () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => result.current.setTargetPath("/foo/bar"));
    expect(result.current.state.targetPath).toBe("/foo/bar");
  });

  it("sets source", () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => result.current.setSource("sdcard"));
    expect(result.current.state.source).toBe("sdcard");
  });

  it("sets sdCardMounted", () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => result.current.setSdCardMounted(true));
    expect(result.current.state.sdCardMounted).toBe(true);
  });

  it("sets error", () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => result.current.setError("fail"));
    expect(result.current.state.error).toBe("fail");
  });

  it("sets isInitializing", () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => result.current.setIsInitializing(true));
    expect(result.current.state.isInitializing).toBe(true);
  });

  it("initialize handles errors", async () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    // Patch initialize to throw
    result.current.initialize = async () => {
      result.current.setIsInitializing(true);
      result.current.setError("fail");
      result.current.setIsInitializing(false);
    };
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toBe("fail");
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("sets target path and always appends /romper if missing", async () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => result.current.setTargetPath("/foo/bar"));
    expect(result.current.state.targetPath).toBe("/foo/bar");
    // Simulate UI logic: always append /romper if missing
    let customPath = "/foo/custom";
    if (!/romper\/?$/.test(customPath)) {
      customPath = customPath.replace(/\/+$/, "") + "/romper";
    }
    act(() => result.current.setTargetPath(customPath));
    expect(result.current.state.targetPath).toBe("/foo/custom/romper");
  });

  it("[UC-02] initializes from Squarp.net archive (downloads and extracts)", async () => {
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (destDir) => {
        if (!destDir.includes("romper")) throw new Error("Invalid destDir");
        return { success: true };
      },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isInitializing).toBe(false);
  });

  // RE-42: the caller shows the notice from this result
  it("[UC-01] [UC-02] returns the samples a voice over 12 left out", async () => {
    const root = "/mock/home/Documents/romper";
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (dir) => (dir === root ? ["A0"] : []),
    );
    // Main imported the first 12 of voice 1's 13 files
    vi.mocked(window.electronAPI.setupImportKit).mockImplementation(
      async () => ({
        data: importResult([
          { filename: "1 kick 13.wav", reason: "voice_full", voiceNumber: 1 },
        ]),
        success: true,
      }),
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath(root);
      result.current.setSource("squarp");
    });
    let outcome: Awaited<ReturnType<typeof result.current.initialize>>;
    await act(async () => {
      outcome = await result.current.initialize();
    });
    expect(outcome!).toEqual({
      success: true,
      truncationWarnings: [
        expect.objectContaining({
          kept: 12,
          kitName: "A0",
          skipped: 1,
          total: 13,
          voiceNumber: 1,
        }),
      ],
    });
  });

  it("handles download/extract error", async () => {
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async () => ({
        error: "fail",
        success: false,
      }),
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toMatch(
      /Factory samples download failed/,
    );
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("sets and clears progress during Squarp.net archive initialization", async () => {
    let progressCb: unknown = null;
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir, onProgress) => {
        progressCb = onProgress;
        // Simulate progress events
        if (progressCb) progressCb({ percent: 10, phase: "Downloading" });
        if (progressCb) progressCb({ percent: 80, phase: "Extracting" });
        return { success: true };
      },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    // Progress should be cleared after completion
    expect(result.current.progress).toBeNull();
    expect(result.current.state.error).toBeNull();
  });

  it("handles premature close error with user-friendly message", async () => {
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir, _onProgress, onError) => {
        if (onError) onError({ message: "premature close" });
        return { error: "premature close", success: false };
      },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toMatch(
      /Factory samples download failed/,
    );
    expect(result.current.state.isInitializing).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it("[UC-03] initializes blank folder (no files copied, only folder created)", async () => {
    let ensureDirCalled = false;
    vi.mocked(window.electronAPI.ensureDir).mockImplementation(async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    });
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(ensureDirCalled).toBe(true);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("initializes squarp source and ensures directory is created", async () => {
    let ensureDirCalled = false;
    vi.mocked(window.electronAPI.ensureDir).mockImplementation(async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    });
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir) => {
        return { success: true };
      },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(ensureDirCalled).toBe(true);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("initializes sdcard source and ensures directory is created (copy logic not yet implemented)", async () => {
    let ensureDirCalled = false;
    vi.mocked(window.electronAPI.ensureDir).mockImplementation(async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    });
    // SD card returns one kit folder, local store returns same kit folder
    vi.mocked(window.electronAPI.listFilesInRoot)
      .mockImplementationOnce(async () => ["A0"]) // SD card
      .mockImplementationOnce(async () => ["A0"]) // local store
      .mockImplementation(async () => []); // kit folder contents
    vi.mocked(window.electronAPI.copyDir).mockImplementation();
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("sdcard");
      result.current.setSdCardPath("/mock/sd");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(ensureDirCalled).toBe(true);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("[UC-01] copies all valid kit folders from SD card to local store", async () => {
    // SD card returns two kit folders, local store returns same kit folders
    vi.mocked(window.electronAPI.listFilesInRoot)
      .mockImplementationOnce(async () => ["A0", "B12", "notakit"]) // SD card
      .mockImplementationOnce(async () => ["A0", "B12"]) // local store
      .mockImplementation(async () => []); // kit folder contents
    const copyDir = vi.fn();
    vi.mocked(window.electronAPI.copyDir).mockImplementation(copyDir);
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("sdcard");
      result.current.setSdCardPath("/mock/sd");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.kitFolderValidationError).toBeUndefined();
    expect(result.current.state.error).toBeNull();
    expect(copyDir).toHaveBeenCalledTimes(2);
    expect(copyDir).toHaveBeenCalledWith(
      "/mock/sd/A0",
      "/mock/home/Documents/romper/A0",
    );
    expect(copyDir).toHaveBeenCalledWith(
      "/mock/sd/B12",
      "/mock/home/Documents/romper/B12",
    );
  });

  it("loads localStorePath from settings if present", async () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    // Now defaultPath is always getDefaultRomperPathAsync, not from settings
    expect(result.current.defaultPath).toBe("/mock/home/Documents/romper");
    // targetPath is not set on mount anymore
    expect(result.current.state.targetPath).toBe("");
  });

  it("persists localStorePath after successful initialization", async () => {
    let setSettingCalled = false;
    vi.mocked(window.electronAPI.setSetting).mockImplementation(
      async (key, value) => {
        if (key === "localStorePath") setSettingCalled = value;
      },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(setSettingCalled).toBe("/mock/home/Documents/romper");
  });

  it("shows progress for writing to database during DB import", async () => {
    const progressEvents: unknown[] = [];
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (path) => {
        if (path === "/mock/sd") return ["A0", "B12"];
        if (path === "/mock/home/Documents/romper") return ["A0", "B12"];
        if (path === "/mock/home/Documents/romper/A0")
          return ["kick.wav", "snare.wav"];
        if (path === "/mock/home/Documents/romper/B12") return ["hat.wav"];
        return [];
      },
    );
    vi.mocked(window.electronAPI.copyDir).mockImplementation(async () => {});
    // Use the new progress callback for testability
    const { result } = renderHook(() =>
      useLocalStoreWizard((p) => progressEvents.push(p)),
    );
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("sdcard");
      result.current.setSdCardPath("/mock/sd");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(progressEvents.some((e) => e.phase === "Writing to database")).toBe(
      true,
    );
  });

  // RE-34: main imports each kit (samples, WAV metadata, voice names); the
  // renderer neither reads WAVs nor writes voice names any more
  describe("[UC-02] importing kits", () => {
    const root = "/mock/home/Documents/romper";
    const startSetup = async () => {
      const { result } = renderHook(() => useLocalStoreWizard());
      await waitForAsync(() => result.current.defaultPath !== "");
      act(() => {
        result.current.setTargetPath(root);
        result.current.setSource("squarp");
      });
      await act(async () => {
        await result.current.initialize();
      });
      return result;
    };

    it("asks main to import each kit folder, and nothing else", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => (dir === root ? ["A0", "B12", "notakit"] : []),
      );

      const result = await startSetup();

      expect(result.current.state.error).toBeNull();
      expect(window.electronAPI.setupImportKit).toHaveBeenCalledTimes(2);
      expect(window.electronAPI.setupImportKit).toHaveBeenCalledWith(
        `${root}/.romperdb`,
        "A0",
      );
      expect(window.electronAPI.setupImportKit).toHaveBeenCalledWith(
        `${root}/.romperdb`,
        "B12",
      );
      expect(window.electronAPI.readFile).not.toHaveBeenCalled();
      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
      expect(window.electronAPI.setSetting).toHaveBeenCalledWith(
        "localStorePath",
        root,
      );
    });

    it("stops, and doesn't save the store, when main can't import a kit", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => (dir === root ? ["A0"] : []),
      );
      vi.mocked(window.electronAPI.setupImportKit).mockResolvedValue({
        error: "Can't read kit folder A0",
        success: false,
      });

      const result = await startSetup();

      expect(result.current.state.error).toMatch(/Can't read kit folder A0/);
      expect(window.electronAPI.setSetting).not.toHaveBeenCalledWith(
        "localStorePath",
        expect.anything(),
      );
    });

    it("imports nothing when there are no kit folders", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async () => [],
      );

      await startSetup();

      expect(window.electronAPI.setupImportKit).not.toHaveBeenCalled();
    });
  });

  it("shows disk space error when insufficient space for squarp download", async () => {
    vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValue({
      writable: true,
    });
    vi.mocked(window.electronAPI.checkDiskSpace).mockResolvedValue({
      availableBytes: 100 * 1024 * 1024,
      requiredBytes: 1024 * 1024 * 1024,
      sufficient: false,
    });
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toMatch(/Not enough disk space/);
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("shows writability error when target path is not writable", async () => {
    vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValue({
      error: "Permission denied",
      writable: false,
    });
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/read-only/path/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toMatch(/Cannot write to/);
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("calls cleanupPartialInit on initialization failure", async () => {
    const cleanupMock = vi.fn().mockResolvedValue({ removed: true });
    vi.mocked(window.electronAPI.cleanupPartialInit).mockImplementation(
      cleanupMock,
    );
    vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValue({
      writable: true,
    });
    // Force an error during database creation
    vi.mocked(window.electronAPI.listFilesInRoot).mockRejectedValue(
      new Error("DB creation failed"),
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toBeTruthy();
    expect(cleanupMock).toHaveBeenCalledWith("/mock/home/Documents/romper");
  });

  it("refuses a target that already has a local store and leaves it alone (RE-10)", async () => {
    const message =
      'This folder already contains a Romper local store (.romperdb). Use "Choose Existing Store".';
    vi.mocked(window.electronAPI.checkExistingLocalStore).mockResolvedValueOnce(
      { error: message, exists: true },
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/existing");
      result.current.setSource("squarp");
    });
    let initResult: { error?: string; success: boolean } | undefined;
    await act(async () => {
      initResult = await result.current.initialize();
    });

    expect(window.electronAPI.checkExistingLocalStore).toHaveBeenCalledWith(
      "/mock/home/Documents/existing",
    );
    expect(initResult).toEqual({ error: message, success: false });
    expect(result.current.state.error).toBe(message);
    // Nothing was written, so nothing is cleaned up
    expect(window.electronAPI.ensureDir).not.toHaveBeenCalled();
    expect(window.electronAPI.downloadAndExtractArchive).not.toHaveBeenCalled();
    expect(window.electronAPI.createRomperDb).not.toHaveBeenCalled();
    expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
    expect(window.electronAPI.setSetting).not.toHaveBeenCalled();
  });

  it("surfaces main's refusal to create a database over an existing store", async () => {
    // Covers a store appearing between the pre-check and creation
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValueOnce({
      error: "This folder already contains a Romper local store (.romperdb).",
      success: false,
    });
    vi.mocked(window.electronAPI.cleanupPartialInit).mockResolvedValueOnce({
      error:
        "Refusing to clean up a local store that this setup did not create",
      removed: false,
    });
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.state.error).toMatch(
      /already contains a Romper local store/,
    );
    expect(window.electronAPI.setupImportKit).not.toHaveBeenCalled();
  });

  it("does not ask main to clean up when setup fails before creating the database", async () => {
    vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValueOnce({
      writable: false,
    });
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/read-only/path/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.state.error).toMatch(/Cannot write to/);
    expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
  });

  it("skips disk space check for blank folder source", async () => {
    const checkDiskSpaceMock = vi.fn();
    vi.mocked(window.electronAPI.checkDiskSpace).mockImplementation(
      checkDiskSpaceMock,
    );
    vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValue({
      writable: true,
    });
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async () => [],
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(checkDiskSpaceMock).not.toHaveBeenCalled();
  });
});

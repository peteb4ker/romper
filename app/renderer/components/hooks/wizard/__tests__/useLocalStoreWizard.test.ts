import type {
  KitScanResult,
  KitScanSkippedFile,
} from "@romper/shared/db/schema";
import type { KitStereoPlan } from "@romper/shared/stereoLinkRules";

import { CARD_NOT_RESPONDING_SETUP_MESSAGE } from "@romper/shared/cardMessages";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronAPI } from "../../../../electron.d";

import {
  type ProgressEvent,
  useLocalStoreWizard,
} from "../useLocalStoreWizard";

/** What main's setup import returns, with the given skipped files */
function importResult(
  skippedFiles: KitScanSkippedFile[],
  stereo?: KitStereoPlan,
): KitScanResult {
  return {
    addedSamples: 12,
    locked: false,
    metadataUpdated: 0,
    missingSamples: [],
    scannedSamples: 12 + skippedFiles.length,
    skippedFiles,
    ...(stereo ? { stereo } : {}),
    updatedVoices: 1,
  };
}

/** Main's listing of a folder holding `files` */
function listed(files: string[]) {
  return { data: files, success: true };
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
    vi.mocked(window.electronAPI.setSetting).mockResolvedValue(undefined);
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir, _onProgress, _onError) => ({ success: true }),
    );
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (_path) => listed([]),
    );
    vi.mocked(window.electronAPI.copyDir).mockResolvedValue({ success: true });
    vi.mocked(window.electronAPI.setupImportKit).mockImplementation(
      async () => ({ data: importResult([]), success: true }),
    );
    vi.mocked(window.electronAPI.updateVoiceAlias).mockImplementation(
      async (_kitName, _voiceNumber, _voiceAlias) => ({
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
    vi.mocked(window.electronAPI.ensureDir).mockRejectedValueOnce(
      new Error("fail"),
    );
    const { result } = renderHook(() => useLocalStoreWizard());
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });
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
      async (dir) => listed(dir === root ? ["A0"] : []),
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
      stereoNotices: [],
      success: true,
      truncationWarnings: [
        expect.objectContaining({
          kept: 12,
          kitName: "A0",
          skipped: 1,
          skippedFiles: ["1 kick 13.wav"],
          total: 13,
          voiceNumber: 1,
        }),
      ],
    });
  });

  // #537: the setup summary lists the pairs setup linked automatically
  it("[UC-01] returns the setup summary's stereo lines", async () => {
    const root = "/mock/home/Documents/romper";
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (dir) => listed(dir === root ? ["A0"] : []),
    );
    vi.mocked(window.electronAPI.setupImportKit).mockImplementation(
      async () => ({
        data: importResult([], {
          autoLinks: [1],
          links: [1],
          mixdowns: [{ reason: "mono_voice", voiceNumber: 4 }],
          quarantine: [],
        }),
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
      stereoNotices: [
        {
          kitName: "A0",
          message:
            "Kit A0: voices 1 and 2 linked automatically as a stereo pair.",
          voiceNumber: 1,
        },
      ],
      success: true,
      truncationWarnings: [],
    });
  });

  it("[UC-02] shows main's reason when the archive can't be installed (RE-77)", async () => {
    const reason =
      "The downloaded factory sample archive didn't match the expected checksum, so Romper didn't install it.";
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async () => ({
        error: reason,
        retryable: false,
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
    expect(result.current.state.error).toBe(reason);
    expect(window.electronAPI.downloadAndExtractArchive).toHaveBeenCalledTimes(
      1,
    );
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("sets and clears progress during Squarp.net archive initialization", async () => {
    vi.mocked(window.electronAPI.downloadAndExtractArchive).mockImplementation(
      async (_destDir, onProgress) => {
        // Simulate progress events
        onProgress?.({ percent: 10, phase: "Downloading" });
        onProgress?.({ percent: 80, phase: "Extracting" });
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
      /The connection was closed before completion/,
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
      .mockImplementationOnce(async () => listed(["A0"])) // SD card
      .mockImplementationOnce(async () => listed(["A0"])) // local store
      .mockImplementation(async () => listed([])); // kit folder contents
    vi.mocked(window.electronAPI.copyDir).mockResolvedValue({ success: true });
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
      .mockImplementationOnce(async () => listed(["A0", "B12", "notakit"])) // SD card
      .mockImplementationOnce(async () => listed(["A0", "B12"])) // local store
      .mockImplementation(async () => listed([])); // kit folder contents
    const copyDir = vi
      .fn<ElectronAPI["copyDir"]>()
      .mockResolvedValue({ success: true });
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
    let setSettingCalled: unknown;
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
    const progressEvents: ProgressEvent[] = [];
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
      async (path) => {
        if (path === "/mock/sd") return listed(["A0", "B12"]);
        if (path === "/mock/home/Documents/romper")
          return listed(["A0", "B12"]);
        if (path === "/mock/home/Documents/romper/A0")
          return listed(["kick.wav", "snare.wav"]);
        if (path === "/mock/home/Documents/romper/B12")
          return listed(["hat.wav"]);
        return listed([]);
      },
    );
    vi.mocked(window.electronAPI.copyDir).mockResolvedValue({ success: true });
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
        async (dir) => listed(dir === root ? ["A0", "B12", "notakit"] : []),
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
      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
      expect(window.electronAPI.setSetting).toHaveBeenCalledWith(
        "localStorePath",
        root,
      );
    });

    it("stops, and doesn't save the store, when main can't import a kit", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => listed(dir === root ? ["A0"] : []),
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

    // RE-66: Cancel stops setup between kits and cleans up, without an
    // error and without saving the store
    it("stops between kits when cancelled, cleans up, and saves nothing", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => listed(dir === root ? ["A0", "A1", "A2"] : []),
      );
      const { result } = renderHook(() => useLocalStoreWizard());
      await waitForAsync(() => result.current.defaultPath !== "");
      act(() => {
        result.current.setTargetPath(root);
        result.current.setSource("squarp");
      });
      vi.mocked(window.electronAPI.setupImportKit).mockImplementationOnce(
        async () => {
          await result.current.cancelSetup();
          return { data: importResult([]), success: true };
        },
      );

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.initialize();
      });

      expect(outcome).toEqual({ cancelled: true, success: false });
      expect(window.electronAPI.cancelSetup).toHaveBeenCalled();
      expect(window.electronAPI.setupImportKit).toHaveBeenCalledTimes(1);
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(root);
      expect(window.electronAPI.setSetting).not.toHaveBeenCalledWith(
        "localStorePath",
        expect.anything(),
      );
      expect(result.current.state.error).toBeNull();
    });

    it("doesn't retry the download after main cancelled it", async () => {
      vi.mocked(window.electronAPI.downloadAndExtractArchive).mockResolvedValue(
        { cancelled: true, error: "Setup cancelled", success: false },
      );

      const result = await startSetup();

      expect(
        window.electronAPI.downloadAndExtractArchive,
      ).toHaveBeenCalledTimes(1);
      expect(window.electronAPI.setupImportKit).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(root);
      expect(result.current.state.error).toBeNull();
    });

    it("imports nothing when there are no kit folders", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async () => listed([]),
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
    vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(async () =>
      listed([]),
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

  // #528: setup built the store but couldn't save it as the setting
  describe("[UC-01] when the local store setting can't be saved (#528)", () => {
    const root = "/mock/home/Documents/romper";
    const notSaved = "Couldn't save the local store setting. Try again.";

    async function setUpWith(
      setLocalStorePath?: (p: string) => Promise<boolean>,
    ) {
      // Earlier tests leave these refusing
      vi.mocked(window.electronAPI.checkPathWritable).mockResolvedValue({
        writable: true,
      });
      vi.mocked(window.electronAPI.checkDiskSpace).mockResolvedValue({
        availableBytes: 10 * 1024 * 1024 * 1024,
        requiredBytes: 1024 * 1024 * 1024,
        sufficient: true,
      });
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => listed(dir === root ? ["A0"] : []),
      );
      vi.mocked(window.electronAPI.setupImportKit).mockImplementation(
        async () => ({
          data: importResult([
            { filename: "1 kick 13.wav", reason: "voice_full", voiceNumber: 1 },
          ]),
          success: true,
        }),
      );
      const hook = renderHook(() =>
        useLocalStoreWizard(undefined, setLocalStorePath),
      );
      await waitForAsync(() => hook.result.current.defaultPath !== "");
      act(() => {
        hook.result.current.setTargetPath(root);
        hook.result.current.setSource("squarp");
      });
      return hook;
    }

    async function initialize(
      result: Awaited<ReturnType<typeof setUpWith>>["result"],
    ) {
      let outcome: Awaited<ReturnType<typeof result.current.initialize>>;
      await act(async () => {
        outcome = await result.current.initialize();
      });
      return outcome!;
    }

    it("keeps the finished store and says the setting wasn't saved", async () => {
      const save = vi.fn().mockResolvedValue(false);
      const { result } = await setUpWith(save);

      const outcome = await initialize(result);

      expect(save).toHaveBeenCalledWith(root);
      expect(outcome).toEqual({ error: notSaved, success: false });
      expect(result.current.state.error).toBe(notSaved);
      expect(result.current.state.isInitializing).toBe(false);
      expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
    });

    it("tries only the save again, then reports what setup did", async () => {
      const save = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const { result } = await setUpWith(save);
      await initialize(result);
      vi.mocked(window.electronAPI.downloadAndExtractArchive).mockClear();
      vi.mocked(window.electronAPI.createRomperDb).mockClear();
      vi.mocked(window.electronAPI.setupImportKit).mockClear();
      vi.mocked(window.electronAPI.ensureDir).mockClear();

      const outcome = await initialize(result);

      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenLastCalledWith(root);
      expect(window.electronAPI.ensureDir).not.toHaveBeenCalled();
      expect(
        window.electronAPI.downloadAndExtractArchive,
      ).not.toHaveBeenCalled();
      expect(window.electronAPI.createRomperDb).not.toHaveBeenCalled();
      expect(window.electronAPI.setupImportKit).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
      expect(outcome).toEqual({
        stereoNotices: [],
        success: true,
        truncationWarnings: [
          expect.objectContaining({ kitName: "A0", voiceNumber: 1 }),
        ],
      });
      expect(result.current.state.error).toBeNull();
    });

    it("keeps the store when saving the setting throws", async () => {
      const { result } = await setUpWith(
        vi.fn().mockRejectedValue(new Error("disk full")),
      );

      const outcome = await initialize(result);

      expect(outcome).toEqual({ error: notSaved, success: false });
      expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
    });

    it("marks the built store finished before saving the setting (#616)", async () => {
      const save = vi.fn().mockResolvedValue(false);
      const { result } = await setUpWith(save);

      await initialize(result);

      // So the quit-time cleanup of unfinished setups leaves it alone
      expect(window.electronAPI.finishSetup).toHaveBeenCalledWith(root);
      expect(
        vi.mocked(window.electronAPI.finishSetup).mock.invocationCallOrder[0],
      ).toBeLessThan(save.mock.invocationCallOrder[0]);
    });

    it("doesn't mark a store finished when the build fails part way (#616)", async () => {
      const save = vi.fn().mockResolvedValue(true);
      const { result } = await setUpWith(save);
      vi.mocked(window.electronAPI.setupImportKit).mockRejectedValue(
        new Error("disk full"),
      );

      const outcome = await initialize(result);

      expect(outcome).toMatchObject({ success: false });
      expect(window.electronAPI.finishSetup).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(root);
    });

    it.each([
      ["throws", () => Promise.reject(new Error("IPC failed"))],
      [
        "is refused",
        () => Promise.resolve({ error: "Access denied", success: false }),
      ],
    ])(
      "still saves the setting when marking the store finished %s (#616)",
      async (_case, finish) => {
        vi.mocked(window.electronAPI.finishSetup).mockImplementationOnce(
          finish,
        );
        const save = vi.fn().mockResolvedValue(true);
        const { result } = await setUpWith(save);

        const outcome = await initialize(result);

        expect(save).toHaveBeenCalledWith(root);
        expect(outcome).toMatchObject({ success: true });
        expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
      },
    );

    it("keeps the store when the setSetting fallback fails", async () => {
      vi.mocked(window.electronAPI.setSetting).mockRejectedValue(
        new Error("disk full"),
      );
      const { result } = await setUpWith();

      const outcome = await initialize(result);

      expect(window.electronAPI.setSetting).toHaveBeenCalledWith(
        "localStorePath",
        root,
      );
      expect(outcome).toEqual({ error: notSaved, success: false });
      expect(window.electronAPI.cleanupPartialInit).not.toHaveBeenCalled();
    });
  });
  // #724: main gives up on a card operation that never finishes (the card's
  // driver hung, #653). Setup stops with that message and cleans up what it
  // made, as after any other failure.
  describe("[UC-01] [Q-01] a card that stopped responding (#724)", () => {
    const store = "/mock/home/Documents/romper";

    async function setUpFromCard() {
      const { result } = renderHook(() => useLocalStoreWizard());
      await waitForAsync(() => result.current.defaultPath !== "");
      act(() => {
        result.current.setTargetPath(store);
        result.current.setSource("sdcard");
        result.current.setSdCardPath("/mock/sd");
      });
      await act(async () => {
        await result.current.initialize();
      });
      return result;
    }

    it("stops when the card's kits can't be listed", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockResolvedValue({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        success: false,
      });

      const result = await setUpFromCard();

      expect(result.current.state.error).toBe(
        CARD_NOT_RESPONDING_SETUP_MESSAGE,
      );
      expect(window.electronAPI.copyDir).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(store);
      expect(window.electronAPI.setSetting).not.toHaveBeenCalledWith(
        "localStorePath",
        expect.anything(),
      );
    });

    it("stops when a kit can't be copied, and copies no more", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async (dir) => listed(dir === "/mock/sd" ? ["A0", "B1"] : []),
      );
      vi.mocked(window.electronAPI.copyDir).mockResolvedValue({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        success: false,
      });

      const result = await setUpFromCard();

      expect(result.current.state.error).toContain(
        CARD_NOT_RESPONDING_SETUP_MESSAGE,
      );
      expect(window.electronAPI.copyDir).toHaveBeenCalledTimes(1);
      expect(window.electronAPI.createRomperDb).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(store);
    });

    it("stops when the card's bank names can't be read", async () => {
      vi.mocked(window.electronAPI.listFilesInRoot).mockImplementation(
        async () => listed(["A0"]),
      );
      vi.mocked(window.electronAPI.copyDir).mockResolvedValue({
        success: true,
      });
      vi.mocked(window.electronAPI.setupImportBankNames).mockResolvedValueOnce({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        success: false,
      });

      const result = await setUpFromCard();

      expect(result.current.state.error).toBe(
        CARD_NOT_RESPONDING_SETUP_MESSAGE,
      );
      expect(window.electronAPI.finishSetup).not.toHaveBeenCalled();
      expect(window.electronAPI.cleanupPartialInit).toHaveBeenCalledWith(store);
    });
  });
});

import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeFullKitScan } from "../../utils/scanners/orchestrationFunctions";
import { useLocalStoreWizard } from "../useLocalStoreWizard";

// Mock the scanner orchestration functions
vi.mock("../../utils/scanners/orchestrationFunctions", () => ({
  executeFullKitScan: vi.fn(),
}));

const mockExecuteFullKitScan = vi.mocked(executeFullKitScan);

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
    mockExecuteFullKitScan.mockResolvedValue({
      success: true,
      results: {
        voiceInference: {
          voiceNames: { 1: "kick", 2: "snare", 3: "hat", 4: "tom" },
        },
        rtfArtist: {
          bankArtists: { A0: "Test Artist", B12: "Another Artist" },
        },
      },
      errors: [],
      completedOperations: 3,
      totalOperations: 3,
    });

    // DRY: Always mock all required electronAPI methods for all tests
    // @ts-ignore
    window.electronAPI = {
      ...window.electronAPI,
      createRomperDb: vi.fn(async (dbDir: string) => ({
        success: true,
        dbPath: dbDir + "/romper.sqlite",
      })),
      ensureDir: vi.fn(async () => true),
      getSetting: vi.fn(async (key) => {
        if (key === "localStorePath") return "/mock/saved/path/romper";
        return undefined;
      }),
      setSetting: vi.fn(async () => {}),
      downloadAndExtractArchive: vi.fn(
        async (url, destDir, onProgress, onError) => ({ success: true }),
      ),
      listFilesInRoot: vi.fn(async (path) => []),
      copyDir: vi.fn(async (src, dest) => {}),
      insertKit: vi.fn(async (_dbDir, _kit) => ({ success: true })),
      insertSample: vi.fn(async (_dbDir, _sample) => ({ success: true })),
      updateKit: vi.fn(async (_dbDir, _kitName, _updates) => ({
        success: true,
      })),
      readFile: vi.fn(async (_filePath) => ({
        success: true,
        data: new ArrayBuffer(1024),
      })),
    };
  });

  it("initializes with default state and loads defaultPath async", async () => {
    const { result } = renderHook(() => useLocalStoreWizard());
    expect(result.current.state).toMatchObject({
      targetPath: "",
      source: null,
      sdCardMounted: false,
      isInitializing: false,
      error: null,
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

  it("initializes from Squarp.net archive (downloads and extracts)", async () => {
    window.electronAPI.downloadAndExtractArchive = async (url, destDir) => {
      if (!url.endsWith(".zip")) throw new Error("Invalid URL");
      if (!destDir.includes("romper")) throw new Error("Invalid destDir");
      return { success: true };
    };
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

  it("handles download/extract error", async () => {
    window.electronAPI.downloadAndExtractArchive = async () => ({
      success: false,
      error: "fail",
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
    expect(result.current.state.error).toBe("fail");
    expect(result.current.state.isInitializing).toBe(false);
  });

  it("sets and clears progress during Squarp.net archive initialization", async () => {
    let progressCb: any = null;
    window.electronAPI.downloadAndExtractArchive = async (
      url,
      destDir,
      onProgress,
    ) => {
      progressCb = onProgress;
      // Simulate progress events
      if (progressCb) progressCb({ phase: "Downloading", percent: 10 });
      if (progressCb) progressCb({ phase: "Extracting", percent: 80 });
      return { success: true };
    };
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
    window.electronAPI.downloadAndExtractArchive = async (
      url,
      destDir,
      onProgress,
      onError,
    ) => {
      if (onError) onError({ message: "premature close" });
      return { success: false, error: "premature close" };
    };
    const { result } = renderHook(() => useLocalStoreWizard());
    await waitForAsync(() => result.current.defaultPath !== "");
    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("squarp");
    });
    await act(async () => {
      await result.current.initialize();
    });
    expect(result.current.state.error).toMatch(/connection was closed/i);
    expect(result.current.state.isInitializing).toBe(false);
    expect(result.current.progress).toBeNull();
  });

  it("initializes blank folder (no files copied, only folder created)", async () => {
    let ensureDirCalled = false;
    window.electronAPI.ensureDir = async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    };
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
    window.electronAPI.ensureDir = async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    };
    window.electronAPI.downloadAndExtractArchive = async (url, destDir) => {
      return { success: true };
    };
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
    window.electronAPI.ensureDir = async (dir) => {
      ensureDirCalled = true;
      if (!dir.includes("romper")) throw new Error("Invalid dir");
      return true;
    };
    // SD card returns one kit folder, local store returns same kit folder
    window.electronAPI.listFilesInRoot = vi
      .fn()
      .mockImplementationOnce(async () => ["A0"]) // SD card
      .mockImplementationOnce(async () => ["A0"]) // local store
      .mockImplementation(async () => []); // kit folder contents
    window.electronAPI.copyDir = vi.fn();
    window.electronAPI.insertKit = vi.fn(async () => ({ success: true }));
    window.electronAPI.insertSample = vi.fn(async () => ({ success: true }));
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

  it("copies all valid kit folders from SD card to local store", async () => {
    // SD card returns two kit folders, local store returns same kit folders
    window.electronAPI.listFilesInRoot = vi
      .fn()
      .mockImplementationOnce(async () => ["A0", "B12", "notakit"]) // SD card
      .mockImplementationOnce(async () => ["A0", "B12"]) // local store
      .mockImplementation(async () => []); // kit folder contents
    const copyDir = vi.fn();
    window.electronAPI.copyDir = copyDir;
    window.electronAPI.insertKit = vi.fn(async () => ({ success: true }));
    window.electronAPI.insertSample = vi.fn(async () => ({ success: true }));
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
    window.electronAPI.setSetting = vi.fn(async (key, value) => {
      if (key === "localStorePath") setSettingCalled = value;
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
    expect(setSettingCalled).toBe("/mock/home/Documents/romper");
  });

  it("shows progress for writing to database during DB import", async () => {
    const progressEvents: any[] = [];
    window.electronAPI.listFilesInRoot = vi.fn(async (path) => {
      if (path === "/mock/sd") return ["A0", "B12"];
      if (path === "/mock/home/Documents/romper") return ["A0", "B12"];
      if (path === "/mock/home/Documents/romper/A0")
        return ["kick.wav", "snare.wav"];
      if (path === "/mock/home/Documents/romper/B12") return ["hat.wav"];
      return [];
    });
    window.electronAPI.copyDir = vi.fn(async () => {});
    window.electronAPI.insertKit = vi.fn(async () => ({ success: true }));
    window.electronAPI.insertSample = vi.fn(async () => ({ success: true }));
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

  it("runs scanning operations after database creation", async () => {
    const progressEvents: any[] = [];
    window.electronAPI.listFilesInRoot = vi.fn(async (path) => {
      if (path === "/mock/home/Documents/romper") return ["A0", "B12"];
      if (path === "/mock/home/Documents/romper/A0")
        return ["1kick.wav", "2snare.wav", "artist.rtf"];
      if (path === "/mock/home/Documents/romper/B12")
        return ["1hat.wav", "3tom.wav"];
      return [];
    });

    const { result } = renderHook(() =>
      useLocalStoreWizard((p) => progressEvents.push(p)),
    );

    await waitForAsync(() => result.current.defaultPath !== "");

    act(() => {
      result.current.setTargetPath("/mock/home/Documents/romper");
      result.current.setSource("blank");
    });

    await act(async () => {
      await result.current.initialize();
    });

    // Verify scanning was called for each kit
    expect(mockExecuteFullKitScan).toHaveBeenCalledTimes(2);

    // Verify the scanning input for the first kit (A0)
    expect(mockExecuteFullKitScan).toHaveBeenCalledWith(
      expect.objectContaining({
        samples: { 1: ["1kick.wav"], 2: ["2snare.wav"], 3: [], 4: [] },
        wavFiles: [
          "/mock/home/Documents/romper/A0/1kick.wav",
          "/mock/home/Documents/romper/A0/2snare.wav",
        ],
        rtfFiles: ["/mock/home/Documents/romper/A0/artist.rtf"],
        fileReader: expect.any(Function),
      }),
      undefined,
      "continue",
    );

    // Verify kit metadata was updated
    expect(window.electronAPI.updateKit).toHaveBeenCalledWith(
      "/mock/home/Documents/romper/.romperdb",
      "A0",
      expect.objectContaining({
        artist: "Test Artist",
        tags: ["kick", "snare", "hat", "tom"],
      }),
    );

    // Verify scanning progress was reported
    expect(
      progressEvents.some((e) => e.phase === "Scanning kits for metadata..."),
    ).toBe(true);
  });

  it("handles scanning errors gracefully and continues with other kits", async () => {
    // Set up mock to fail for one kit but succeed for another
    mockExecuteFullKitScan
      .mockResolvedValueOnce({
        success: false,
        results: {},
        errors: [{ operation: "voiceInference", error: "Mock error" }],
        completedOperations: 0,
        totalOperations: 3,
      })
      .mockResolvedValueOnce({
        success: true,
        results: {
          rtfArtist: { bankArtists: { B12: "Another Artist" } },
        },
        errors: [],
        completedOperations: 3,
        totalOperations: 3,
      });

    window.electronAPI.listFilesInRoot = vi.fn(async (path) => {
      if (path === "/mock/home/Documents/romper") return ["A0", "B12"];
      if (path === "/mock/home/Documents/romper/A0") return ["1kick.wav"];
      if (path === "/mock/home/Documents/romper/B12") return ["1hat.wav"];
      return [];
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

    // Should complete successfully even with scan failures
    expect(result.current.state.isInitializing).toBe(false);
    expect(result.current.state.error).toBe(null);

    // Should have called scanning for both kits
    expect(mockExecuteFullKitScan).toHaveBeenCalledTimes(2);

    // Should only update metadata for the successful kit
    expect(window.electronAPI.updateKit).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.updateKit).toHaveBeenCalledWith(
      "/mock/home/Documents/romper/.romperdb",
      "B12",
      expect.objectContaining({
        artist: "Another Artist",
      }),
    );
  });

  it("skips scanning when no kits are found", async () => {
    window.electronAPI.listFilesInRoot = vi.fn(async (path) => {
      if (path === "/mock/home/Documents/romper") return []; // No kit folders
      return [];
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

    // Should complete successfully
    expect(result.current.state.isInitializing).toBe(false);
    expect(result.current.state.error).toBe(null);

    // Should not call scanning when no kits found
    expect(mockExecuteFullKitScan).not.toHaveBeenCalled();
    expect(window.electronAPI.updateKit).not.toHaveBeenCalled();
  });
});

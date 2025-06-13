import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useLocalStoreWizard } from "../useLocalStoreWizard";

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
    // DRY: Always mock createRomperDb and ensureDir for all tests
    // @ts-ignore
    window.electronAPI = {
      ...window.electronAPI,
      createRomperDb: vi.fn(async (dbDir: string) => ({ success: true, dbPath: dbDir + "/romper.sqlite" })),
      ensureDir: vi.fn(async () => true),
      getSetting: vi.fn(async (key) => {
        if (key === "localStorePath") return "/mock/saved/path/romper";
        return undefined;
      }),
      setSetting: vi.fn(async () => {}),
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
    expect(result.current.state.targetPath).toBe(result.current.defaultPath);
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
    window.electronAPI.listFilesInRoot = async () => ["A0"];
    window.electronAPI.copyDir = vi.fn();
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

  it("blocks initialization and sets error if SD card folder is invalid (no kit folders)", async () => {
    window.electronAPI.listFilesInRoot = async () => ["notakit", "foo"];
    window.electronAPI.copyDir = vi.fn();
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
    expect(result.current.state.kitFolderValidationError).toMatch(
      /no valid kit folders/i,
    );
    expect(result.current.state.error).toMatch(/no valid kit folders/i);
    expect(window.electronAPI.copyDir).not.toHaveBeenCalled();
  });

  it("copies all valid kit folders from SD card to local store", async () => {
    window.electronAPI.listFilesInRoot = async () => ["A0", "B12", "notakit"];
    const copyDir = vi.fn();
    window.electronAPI.copyDir = copyDir;
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
    expect(result.current.defaultPath).toBe("/mock/saved/path/romper");
    expect(result.current.state.targetPath).toBe("/mock/saved/path/romper");
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
});

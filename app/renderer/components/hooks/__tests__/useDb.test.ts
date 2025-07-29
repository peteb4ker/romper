import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDb } from "../useDb";

describe("useDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create the Romper DB and return the sqlite path", async () => {
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValue({
      success: true,
      dbPath: "/mock/path/.romperdb/romper.sqlite",
    });

    const { result } = renderHook(() => useDb());
    const dbDir = "/mock/path/.romperdb";
    const dbPath = await result.current.createRomperDb(dbDir);
    expect(dbPath).toBe("/mock/path/.romperdb/romper.sqlite");
    expect(window.electronAPI.createRomperDb).toHaveBeenCalledWith(dbDir);
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValue({
      success: false,
      error: "fail",
    });
    const { result } = renderHook(() => useDb());
    await expect(result.current.createRomperDb("/fail/path")).rejects.toThrow(
      "fail",
    );
  });
});

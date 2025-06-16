import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDb } from "../useDb";

describe("useDb", () => {
  beforeEach(() => {
    // @ts-ignore
    window.electronAPI = {
      createRomperDb: vi.fn(async (dbDir: string) => ({ success: true, dbPath: dbDir + "/romper.sqlite" }))
    };
  });

  it("should create the Romper DB and return the sqlite path", async () => {
    const { result } = renderHook(() => useDb());
    const dbDir = "/mock/path/.romperdb";
    const dbPath = await result.current.createRomperDb(dbDir);
    expect(dbPath).toBe("/mock/path/.romperdb/romper.sqlite");
    expect(window.electronAPI.createRomperDb).toHaveBeenCalledWith(dbDir);
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    // @ts-ignore
    window.electronAPI.createRomperDb = vi.fn(async () => ({ success: false, error: "fail" }));
    const { result } = renderHook(() => useDb());
    await expect(result.current.createRomperDb("/fail/path")).rejects.toThrow("fail");
  });
});

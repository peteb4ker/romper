import { createRomperDb } from "../utils/romperDb";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("romperDb", () => {
  beforeEach(() => {
    // @ts-ignore
    window.electronAPI = {
      createRomperDb: vi.fn(async (dbDir: string) => ({ success: true, dbPath: dbDir + "/romper.sqlite" }))
    };
  });

  it("should return the expected sqlite path for a given dbDir", async () => {
    const dbDir = "/mock/path/.romperdb";
    const result = await createRomperDb(dbDir);
    expect(result).toBe("/mock/path/.romperdb/romper.sqlite");
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    // @ts-ignore
    window.electronAPI.createRomperDb = vi.fn(async () => ({ success: false, error: "fail" }));
    await expect(createRomperDb("/fail/path")).rejects.toThrow("fail");
  });
});

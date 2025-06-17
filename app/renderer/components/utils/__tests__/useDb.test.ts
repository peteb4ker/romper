import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDb } from "../useDb";

describe("createRomperDb util", () => {
  beforeEach(() => {
    // @ts-ignore
    window.electronAPI = {
      createRomperDb: vi.fn(async (dbDir: string) => ({
        success: true,
        dbPath: dbDir + "/romper.sqlite",
      })),
    };
  });

  it("should create the Romper DB and return the sqlite path", async () => {
    const dbDir = "/mock/path/.romperdb";
    const dbPath = await createRomperDb(dbDir);
    expect(dbPath).toBe("/mock/path/.romperdb/romper.sqlite");
    expect(window.electronAPI.createRomperDb).toHaveBeenCalledWith(dbDir);
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    // @ts-ignore
    window.electronAPI.createRomperDb = vi.fn(async () => ({
      success: false,
      error: "fail",
    }));
    await expect(createRomperDb("/fail/path")).rejects.toThrow("fail");
  });
});

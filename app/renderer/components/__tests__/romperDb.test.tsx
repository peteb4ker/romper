import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDb } from "../utils/romperDb";

describe("romperDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock behavior
    vi.mocked(window.electronAPI.createRomperDb).mockImplementation(
      async (dbDir: string) => ({
        dbPath: dbDir + "/romper.sqlite",
        success: true,
      }),
    );
  });

  it("should return the expected sqlite path for a given dbDir", async () => {
    const dbDir = "/mock/path/.romperdb";
    const result = await createRomperDb(dbDir);
    expect(result).toBe("/mock/path/.romperdb/romper.sqlite");
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValueOnce({
      error: "fail",
      success: false,
    });
    await expect(createRomperDb("/fail/path")).rejects.toThrow("fail");
  });
});

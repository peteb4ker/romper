import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDb, importSetupKit } from "../romperDb";

const imported = {
  addedSamples: 4,
  locked: false,
  metadataUpdated: 0,
  missingSamples: [],
  scannedSamples: 4,
  skippedFiles: [],
  updatedVoices: 2,
};

describe("romperDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.electronAPI.createRomperDb).mockImplementation(
      async (dbDir: string) => ({
        dbPath: dbDir + "/romper.sqlite",
        success: true,
      }),
    );
    vi.mocked(window.electronAPI.setupImportKit).mockResolvedValue({
      data: imported,
      success: true,
    });
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

  it("imports a kit through main and returns what it imported", async () => {
    const result = await importSetupKit("/mock/path/.romperdb", "A0");
    expect(window.electronAPI.setupImportKit).toHaveBeenCalledWith(
      "/mock/path/.romperdb",
      "A0",
    );
    expect(result).toEqual(imported);
  });

  it("throws main's error when the import fails", async () => {
    vi.mocked(window.electronAPI.setupImportKit).mockResolvedValueOnce({
      error: "Not a kit folder name: Drums",
      success: false,
    });
    await expect(
      importSetupKit("/mock/path/.romperdb", "Drums"),
    ).rejects.toThrow("Not a kit folder name: Drums");
  });
});

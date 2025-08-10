import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDb, insertKit, insertSample } from "../romperDb";

describe("romperDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock behaviors
    vi.mocked(window.electronAPI.createRomperDb).mockImplementation(
      async (dbDir: string) => ({
        dbPath: dbDir + "/romper.sqlite",
        success: true,
      }),
    );
    vi.mocked(window.electronAPI.insertKit).mockImplementation(async () => ({
      kitId: 42,
      success: true,
    }));
    vi.mocked(window.electronAPI.insertSample).mockImplementation(async () => ({
      sampleId: 99,
      success: true,
    }));
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

  it("should call insertKit and return kitId", async () => {
    const kit = { editable: true, name: "Test Kit" };
    const kitId = await insertKit("/mock/path", kit);
    expect(window.electronAPI.insertKit).toHaveBeenCalledWith(
      "/mock/path",
      kit,
    );
    expect(kitId).toBe("Test Kit");
  });

  it("should throw if insertKit fails", async () => {
    vi.mocked(window.electronAPI.insertKit).mockResolvedValueOnce({
      error: "kit fail",
      success: false,
    });
    await expect(
      insertKit("/fail/path", { editable: false, name: "fail" }),
    ).rejects.toThrow("kit fail");
  });

  it("should call insertSample and return sampleId", async () => {
    const sample = {
      filename: "kick.wav",
      is_stereo: false,
      kit_id: 1,
      slot_number: 100,
    };
    const sampleId = await insertSample("/mock/path", sample);
    expect(window.electronAPI.insertSample).toHaveBeenCalledWith("/mock/path", {
      filename: "kick.wav",
      is_stereo: false,
      kit_id: 1,
      slot_number: 100,
      source_path: "",
      wav_bitrate: null,
      wav_sample_rate: null,
    });
    expect(sampleId).toBe(99);
  });

  it("should throw if insertSample fails", async () => {
    vi.mocked(window.electronAPI.insertSample).mockResolvedValueOnce({
      error: "sample fail",
      success: false,
    });
    await expect(
      insertSample("/fail/path", {
        filename: "fail.wav",
        is_stereo: false,
        kit_id: 1,
        slot_number: 100,
      }),
    ).rejects.toThrow("sample fail");
  });
});

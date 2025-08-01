import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRomperDb, insertKit, insertSample } from "../romperDb";

describe("romperDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock behaviors
    vi.mocked(window.electronAPI.createRomperDb).mockImplementation(
      async (dbDir: string) => ({
        success: true,
        dbPath: dbDir + "/romper.sqlite",
      }),
    );
    vi.mocked(window.electronAPI.insertKit).mockImplementation(async () => ({
      success: true,
      kitId: 42,
    }));
    vi.mocked(window.electronAPI.insertSample).mockImplementation(async () => ({
      success: true,
      sampleId: 99,
    }));
  });

  it("should return the expected sqlite path for a given dbDir", async () => {
    const dbDir = "/mock/path/.romperdb";
    const result = await createRomperDb(dbDir);
    expect(result).toBe("/mock/path/.romperdb/romper.sqlite");
  });

  it("should throw if electronAPI.createRomperDb fails", async () => {
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValueOnce({
      success: false,
      error: "fail",
    });
    await expect(createRomperDb("/fail/path")).rejects.toThrow("fail");
  });

  it("should call insertKit and return kitId", async () => {
    const kit = { name: "Test Kit", editable: true };
    const kitId = await insertKit("/mock/path", kit);
    expect(window.electronAPI.insertKit).toHaveBeenCalledWith(
      "/mock/path",
      kit,
    );
    expect(kitId).toBe("Test Kit");
  });

  it("should throw if insertKit fails", async () => {
    vi.mocked(window.electronAPI.insertKit).mockResolvedValueOnce({
      success: false,
      error: "kit fail",
    });
    await expect(
      insertKit("/fail/path", { name: "fail", editable: false }),
    ).rejects.toThrow("kit fail");
  });

  it("should call insertSample and return sampleId", async () => {
    const sample = {
      kit_id: 1,
      filename: "kick.wav",
      slot_number: 1,
      is_stereo: false,
    };
    const sampleId = await insertSample("/mock/path", sample);
    expect(window.electronAPI.insertSample).toHaveBeenCalledWith("/mock/path", {
      kit_id: 1,
      filename: "kick.wav",
      slot_number: 1,
      is_stereo: false,
      source_path: "",
      wav_bitrate: null,
      wav_sample_rate: null,
    });
    expect(sampleId).toBe(99);
  });

  it("should throw if insertSample fails", async () => {
    vi.mocked(window.electronAPI.insertSample).mockResolvedValueOnce({
      success: false,
      error: "sample fail",
    });
    await expect(
      insertSample("/fail/path", {
        kit_id: 1,
        filename: "fail.wav",
        slot_number: 1,
        is_stereo: false,
      }),
    ).rejects.toThrow("sample fail");
  });
});

import type { Sample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SampleMetadataService } from "../sampleMetadataService.js";

vi.mock("../../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
}));

vi.mock("../../../utils/fileSystemUtils.js", () => ({
  ServicePathManager: {
    getDbPath: vi.fn((p: string) => `${p}/.romperdb`),
    getLocalStorePath: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { getKitSamples } from "../../../db/romperDbCoreORM.js";
import { ServicePathManager } from "../../../utils/fileSystemUtils.js";

describe("SampleMetadataService", () => {
  let service: SampleMetadataService;
  const mockSettings = { localStorePath: "/mock/store" };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SampleMetadataService();
  });

  describe("getSampleAudioBuffer", () => {
    it("returns error when no local store path configured", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(null);

      const result = service.getSampleAudioBuffer(mockSettings, "A0", 1, 0);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when getKitSamples fails", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
        "/mock/store",
      );
      vi.mocked(getKitSamples).mockReturnValue({
        error: "DB error",
        success: false,
      });

      const result = service.getSampleAudioBuffer(mockSettings, "A0", 1, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get samples for kit A0");
    });

    it("returns null for empty slot (sample not found)", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
        "/mock/store",
      );
      vi.mocked(getKitSamples).mockReturnValue({
        data: [],
        success: true,
      });

      const result = service.getSampleAudioBuffer(mockSettings, "A0", 1, 0);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns audio buffer for existing sample", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
        "/mock/store",
      );

      const mockSample = {
        filename: "kick.wav",
        kit_name: "A0",
        slot_number: 0,
        source_path: "/mock/store/A0/kick.wav",
        voice_number: 1,
      } as Sample;

      vi.mocked(getKitSamples).mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const mockBuffer = Buffer.from("fake audio data");
      vi.mocked(fs.readFileSync).mockReturnValue(mockBuffer);

      const result = service.getSampleAudioBuffer(mockSettings, "A0", 1, 0);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data!.byteLength).toBeGreaterThan(0);
      expect(fs.readFileSync).toHaveBeenCalledWith("/mock/store/A0/kick.wav");
    });

    it("finds correct sample by voice and slot", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
        "/mock/store",
      );

      const samples = [
        {
          filename: "kick.wav",
          kit_name: "A0",
          slot_number: 0,
          source_path: "/kick.wav",
          voice_number: 1,
        },
        {
          filename: "snare.wav",
          kit_name: "A0",
          slot_number: 1,
          source_path: "/snare.wav",
          voice_number: 1,
        },
        {
          filename: "hat.wav",
          kit_name: "A0",
          slot_number: 0,
          source_path: "/hat.wav",
          voice_number: 2,
        },
      ] as Sample[];

      vi.mocked(getKitSamples).mockReturnValue({
        data: samples,
        success: true,
      });

      const mockBuffer = Buffer.from("audio");
      vi.mocked(fs.readFileSync).mockReturnValue(mockBuffer);

      service.getSampleAudioBuffer(mockSettings, "A0", 2, 0);

      expect(fs.readFileSync).toHaveBeenCalledWith("/hat.wav");
    });

    it("returns error when file read fails", () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
        "/mock/store",
      );

      const mockSample = {
        filename: "kick.wav",
        kit_name: "A0",
        slot_number: 0,
        source_path: "/nonexistent.wav",
        voice_number: 1,
      } as Sample;

      vi.mocked(getKitSamples).mockReturnValue({
        data: [mockSample],
        success: true,
      });

      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });

      const result = service.getSampleAudioBuffer(mockSettings, "A0", 1, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read sample audio");
    });
  });
});

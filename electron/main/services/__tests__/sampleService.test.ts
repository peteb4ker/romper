import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the decomposed services
vi.mock("../crud/sampleCrudService.js", () => ({
  sampleCrudService: {
    addSampleToSlot: vi.fn(),
    deleteSampleFromSlot: vi.fn(),
    moveSampleBetweenKits: vi.fn(),
    moveSampleInKit: vi.fn(),
  },
}));

vi.mock("../metadata/sampleMetadataService.js", () => ({
  sampleMetadataService: {
    getSampleAudioBuffer: vi.fn(),
  },
}));

import { sampleCrudService } from "../crud/sampleCrudService.js";
import { sampleMetadataService } from "../metadata/sampleMetadataService.js";
import { SampleService } from "../sampleService.js";

const mockCrudService = vi.mocked(sampleCrudService);
const mockMetadataService = vi.mocked(sampleMetadataService);

describe("SampleService", () => {
  let sampleService: SampleService;
  const mockSettings = { localStorePath: "/test/path" };

  beforeEach(() => {
    vi.clearAllMocks();
    sampleService = new SampleService();
  });

  describe("CRUD Operations - Delegation", () => {
    it("should delegate addSampleToSlot to sampleCrudService", () => {
      mockCrudService.addSampleToSlot.mockReturnValue({
        data: { sampleId: 123 },
        success: true,
      });

      const result = sampleService.addSampleToSlot(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );

      expect(mockCrudService.addSampleToSlot).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
      );
      expect(result.success).toBe(true);
      expect(result.data?.sampleId).toBe(123);
    });

    it("should delegate deleteSampleFromSlot to sampleCrudService", () => {
      mockCrudService.deleteSampleFromSlot.mockReturnValue({
        data: { affectedSamples: [], deletedSamples: [] },
        success: true,
      });

      sampleService.deleteSampleFromSlot(mockSettings, "TestKit", 1, 0);

      expect(mockCrudService.deleteSampleFromSlot).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
      );
    });

    it("should delegate moveSampleInKit to sampleCrudService", () => {
      mockCrudService.moveSampleInKit.mockReturnValue({
        data: { affectedSamples: [], movedSample: {} as Sample },
        success: true,
      });

      sampleService.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        0,
        2,
        1,
        "insert",
      );

      expect(mockCrudService.moveSampleInKit).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
        2,
        1,
        "insert",
      );
    });
  });

  describe("Metadata Operations - Delegation", () => {
    it("should delegate getSampleAudioBuffer to sampleMetadataService", async () => {
      const audio = { bytes: new ArrayBuffer(100), version: "v1" };
      mockMetadataService.getSampleAudioBuffer.mockResolvedValue({
        data: audio,
        success: true,
      });

      const result = await sampleService.getSampleAudioBuffer(
        mockSettings,
        "TestKit",
        1,
        0,
        "v0",
      );

      expect(mockMetadataService.getSampleAudioBuffer).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
        "v0",
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(audio);
    });
  });

  describe("Integration", () => {
    it("should act as orchestrating service for all sample operations", () => {
      // Verify that SampleService provides all expected methods
      expect(typeof sampleService.addSampleToSlot).toBe("function");
      expect(typeof sampleService.deleteSampleFromSlot).toBe("function");
      expect(typeof sampleService.getSampleAudioBuffer).toBe("function");
    });
  });
});

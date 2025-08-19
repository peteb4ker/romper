import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the decomposed services
vi.mock("../crud/sampleCrudService.js", () => ({
  sampleCrudService: {
    addSampleToSlot: vi.fn(),
    deleteSampleFromSlot: vi.fn(),
    deleteSampleFromSlotWithoutReindexing: vi.fn(),
    moveSampleBetweenKits: vi.fn(),
    moveSampleInKit: vi.fn(),
  },
}));

vi.mock("../metadata/sampleMetadataService.js", () => ({
  sampleMetadataService: {
    getSampleAudioBuffer: vi.fn(),
  },
}));

vi.mock("../slot/sampleSlotService.js", () => ({
  sampleSlotService: {
    findNextAvailableSlot: vi.fn(),
    validateSlotBoundary: vi.fn(),
  },
}));

vi.mock("../validation/sampleValidator.js", () => ({
  sampleValidator: {
    validateSampleFile: vi.fn(),
    validateSampleSources: vi.fn(),
    validateVoiceAndSlot: vi.fn(),
  },
}));

vi.mock("../../utils/fileSystemUtils.js", () => ({
  ServicePathManager: {
    getDbPath: vi.fn((path) => `${path}/romper.db`),
    getLocalStorePath: vi.fn(() => "/test/store/path"),
  },
}));

import { sampleCrudService } from "../crud/sampleCrudService.js";
import { sampleMetadataService } from "../metadata/sampleMetadataService.js";
import { SampleService } from "../sampleService.js";
import { sampleSlotService } from "../slot/sampleSlotService.js";
import { sampleValidator } from "../validation/sampleValidator.js";

const mockCrudService = vi.mocked(sampleCrudService);
const mockMetadataService = vi.mocked(sampleMetadataService);
const mockSlotService = vi.mocked(sampleSlotService);
const mockValidator = vi.mocked(sampleValidator);

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
        "/path/to/sample.wav"
      );

      expect(mockCrudService.addSampleToSlot).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
        undefined
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
        0
      );
    });

    it("should delegate moveSampleInKit to sampleCrudService", () => {
      mockCrudService.moveSampleInKit.mockReturnValue({
        data: { affectedSamples: [], movedSample: {} as any },
        success: true,
      });

      sampleService.moveSampleInKit(
        mockSettings,
        "TestKit",
        1,
        0,
        2,
        1,
        "insert"
      );

      expect(mockCrudService.moveSampleInKit).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0,
        2,
        1,
        "insert"
      );
    });
  });

  describe("Metadata Operations - Delegation", () => {
    it("should delegate getSampleAudioBuffer to sampleMetadataService", () => {
      const mockBuffer = new ArrayBuffer(100);
      mockMetadataService.getSampleAudioBuffer.mockReturnValue({
        data: mockBuffer,
        success: true,
      });

      const result = sampleService.getSampleAudioBuffer(
        mockSettings,
        "TestKit",
        1,
        0
      );

      expect(mockMetadataService.getSampleAudioBuffer).toHaveBeenCalledWith(
        mockSettings,
        "TestKit",
        1,
        0
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockBuffer);
    });
  });

  describe("Validation Operations - Delegation", () => {
    it("should delegate validateVoiceAndSlot to sampleValidator", () => {
      mockValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });

      const result = sampleService.validateVoiceAndSlot(1, 0);

      expect(mockValidator.validateVoiceAndSlot).toHaveBeenCalledWith(1, 0);
      expect(result.isValid).toBe(true);
    });

    it("should delegate validateSampleFile to sampleValidator", () => {
      mockValidator.validateSampleFile.mockReturnValue({
        isValid: true,
      });

      const result = sampleService.validateSampleFile("/path/to/file.wav");

      expect(mockValidator.validateSampleFile).toHaveBeenCalledWith(
        "/path/to/file.wav"
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe("Slot Operations - Delegation", () => {
    it("should delegate validateSlotBoundary to sampleSlotService", () => {
      mockSlotService.validateSlotBoundary.mockReturnValue({
        success: true,
      });

      const result = sampleService.validateSlotBoundary(1, 0, []);

      expect(mockSlotService.validateSlotBoundary).toHaveBeenCalledWith(
        1,
        0,
        []
      );
      expect(result.success).toBe(true);
    });

    it("should delegate findNextAvailableSlot to sampleSlotService", () => {
      mockSlotService.findNextAvailableSlot.mockReturnValue(2);

      const result = sampleService.findNextAvailableSlot(1, []);

      expect(mockSlotService.findNextAvailableSlot).toHaveBeenCalledWith(1, []);
      expect(result).toBe(2);
    });
  });

  describe("Integration", () => {
    it("should act as orchestrating service for all sample operations", () => {
      // Verify that SampleService provides all expected methods
      expect(typeof sampleService.addSampleToSlot).toBe("function");
      expect(typeof sampleService.deleteSampleFromSlot).toBe("function");
      expect(typeof sampleService.getSampleAudioBuffer).toBe("function");
      expect(typeof sampleService.validateVoiceAndSlot).toBe("function");
      expect(typeof sampleService.validateSampleFile).toBe("function");
      expect(typeof sampleService.validateSlotBoundary).toBe("function");
      expect(typeof sampleService.findNextAvailableSlot).toBe("function");
    });
  });
});

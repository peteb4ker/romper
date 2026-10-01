import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as romperDbCoreORM from "../../db/romperDbCoreORM.js";
import { SampleValidationService } from "../sampleValidation.js";
import * as sampleValidator from "../validation/sampleValidator.js";

// Mock dependencies
vi.mock("../../db/romperDbCoreORM.js");
vi.mock("../validation/sampleValidator.js");

const mockORM = vi.mocked(romperDbCoreORM);
const mockValidator = vi.mocked(sampleValidator);

describe("SampleValidationService", () => {
  let service: SampleValidationService;

  beforeEach(() => {
    service = new SampleValidationService();
    vi.clearAllMocks();
  });

  describe("validateVoiceAndSlot", () => {
    it("should validate voice and slot parameters", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });

      const result = service.validateVoiceAndSlot(1, 5);

      expect(result.isValid).toBe(true);
      expect(
        mockValidator.sampleValidator.validateVoiceAndSlot,
      ).toHaveBeenCalledWith(1, 5);
    });

    it("should return validation error for invalid parameters", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        error: "Invalid voice number",
        isValid: false,
      });

      const result = service.validateVoiceAndSlot(99, 5);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid voice number");
    });
  });

  describe("validateSampleFile", () => {
    it("should validate sample file path", () => {
      mockValidator.sampleValidator.validateSampleFile.mockReturnValue({
        isValid: true,
      });

      const result = service.validateSampleFile("/path/to/sample.wav");

      expect(result.isValid).toBe(true);
      expect(
        mockValidator.sampleValidator.validateSampleFile,
      ).toHaveBeenCalledWith("/path/to/sample.wav");
    });

    it("should return error for invalid file", () => {
      mockValidator.sampleValidator.validateSampleFile.mockReturnValue({
        error: "File not found",
        isValid: false,
      });

      const result = service.validateSampleFile("/invalid/path.wav");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("File not found");
    });
  });

  describe("validateVoiceNotLinkedPartner", () => {
    it("[UC-28] delegates to the validator and returns its refusal", () => {
      mockValidator.sampleValidator.validateVoiceNotLinkedPartner.mockReturnValue(
        {
          error: "Voice 2 is linked to voice 1 for stereo.",
          isValid: false,
        },
      );

      const result = service.validateVoiceNotLinkedPartner(
        "/db/path",
        "TestKit",
        2,
      );

      expect(result).toEqual({
        error: "Voice 2 is linked to voice 1 for stereo.",
        isValid: false,
      });
      expect(
        mockValidator.sampleValidator.validateVoiceNotLinkedPartner,
      ).toHaveBeenCalledWith("/db/path", "TestKit", 2);
    });
  });

  describe("validateSampleMovement", () => {
    beforeEach(() => {
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReturnValue({
        isValid: true,
      });
    });

    it("should validate successful movement", () => {
      const result = service.validateSampleMovement(1, 2, 3, 4);

      expect(result.success).toBe(true);
      expect(
        mockValidator.sampleValidator.validateVoiceAndSlot,
      ).toHaveBeenCalledTimes(2);
    });

    it("should reject movement to same position", () => {
      const result = service.validateSampleMovement(1, 2, 1, 2);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot move sample to the same position");
    });

    it("should return error for invalid source", () => {
      mockValidator.sampleValidator.validateVoiceAndSlot
        .mockReturnValueOnce({ error: "Invalid source", isValid: false })
        .mockReturnValueOnce({ isValid: true });

      const result = service.validateSampleMovement(99, 2, 3, 4);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Source Invalid source");
    });

    it("should return error for invalid destination", () => {
      // Reset the mock to ensure clean state
      mockValidator.sampleValidator.validateVoiceAndSlot.mockReset();
      mockValidator.sampleValidator.validateVoiceAndSlot
        .mockReturnValueOnce({ isValid: true })
        .mockReturnValueOnce({ error: "Invalid destination", isValid: false });

      const result = service.validateSampleMovement(1, 2, 99, 4);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Destination Invalid destination");
    });
  });

  describe("validateAndGetSampleToMove", () => {
    const mockSample: Sample = {
      filename: "test.wav",
      id: 1,
      kit_name: "TestKit",
      slot_number: 2,
      source_path: "/path/test.wav",
      voice_number: 1,
    };

    it("should successfully find and return sample", () => {
      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const result = service.validateAndGetSampleToMove(
        "/db/path",
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSample);
    });

    it("should return error when sample not found", () => {
      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const result = service.validateAndGetSampleToMove(
        "/db/path",
        "TestKit",
        1,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "No sample found in kit TestKit at voice 1, slot 6",
      );
    });

    it("should handle database error", () => {
      mockORM.getKitSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = service.validateAndGetSampleToMove(
        "/db/path",
        "TestKit",
        1,
        2,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("checkSampleExists", () => {
    const mockSample: Sample = {
      filename: "test.wav",
      id: 1,
      kit_name: "TestKit",
      slot_number: 2,
      source_path: "/path/test.wav",
      voice_number: 1,
    };

    it("should find existing sample", () => {
      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const result = service.checkSampleExists("/db/path", "TestKit", 1, 2);

      expect(result.exists).toBe(true);
      expect(result.sample).toEqual(mockSample);
    });

    it("should return false when sample doesn't exist", () => {
      mockORM.getKitSamples.mockReturnValue({
        data: [mockSample],
        success: true,
      });

      const result = service.checkSampleExists("/db/path", "TestKit", 1, 5);

      expect(result.exists).toBe(false);
      expect(result.sample).toBeUndefined();
    });

    it("should handle database error", () => {
      mockORM.getKitSamples.mockReturnValue({
        error: "Database error",
        success: false,
      });

      const result = service.checkSampleExists("/db/path", "TestKit", 1, 2);

      expect(result.exists).toBe(false);
      expect(result.sample).toBeUndefined();
    });
  });
});

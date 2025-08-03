import { describe, expect, it } from "vitest";

import type { Kit, Sample, Voice } from "../schema";

import {
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  LocalStoreValidationResult,
} from "../schema";

describe("dbTypesShared", () => {
  it("should export all required interfaces", () => {
    // This test simply verifies that all interfaces are exported correctly
    // by checking that they can be imported and used to create objects

    const sampleRecord: Sample = {
      filename: "test.wav",
      is_stereo: false,
      kit_name: "test-kit",
      slot_number: 1,
      voice_number: 1,
      wav_bitrate: 16,
      wav_sample_rate: 44100,
    };
    expect(sampleRecord).toBeDefined();
    expect(sampleRecord.kit_name).toBe("test-kit");

    const kitRecord: Kit = {
      name: "test-kit",
      plan_enabled: false,
    };
    expect(kitRecord).toBeDefined();

    const voiceRecord: Voice = {
      kit_name: "test-kit",
      voice_alias: "Kicks",
      voice_number: 1,
    };
    expect(voiceRecord).toBeDefined();

    const kitValidationError: KitValidationError = {
      extraFiles: ["extra.wav"],
      kitName: "test-kit",
      missingFiles: ["missing.wav"],
    };
    expect(kitValidationError).toBeDefined();

    const validationDetailedResult: LocalStoreValidationDetailedResult = {
      errors: [kitValidationError],
      errorSummary: "Test error",
      isValid: false,
    };
    expect(validationDetailedResult).toBeDefined();

    const validationResult: LocalStoreValidationResult = {
      error: "Test error",
      isValid: false,
      romperDbPath: "/test/path",
    };
    expect(validationResult).toBeDefined();

    const dbResult: DbResult<Sample[]> = {
      data: [sampleRecord],
      success: true,
    };
    expect(dbResult).toBeDefined();
  });
});

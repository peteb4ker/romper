import { describe, expect, it } from "vitest";

import type { Kit, Sample, Voice } from "../schema";

import {
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
} from "../schema";

describe("schema types", () => {
  it("should export all required interfaces", () => {
    // This test simply verifies that all interfaces are exported correctly
    // by checking that they can be imported and used to create objects

    const sampleRecord: Sample = {
      filename: "test.wav",
      id: 1,
      is_stereo: false,
      kit_name: "test-kit",
      slot_number: 1,
      source_path: "/path/to/test.wav",
      voice_number: 1,
      wav_bitrate: 16,
      wav_sample_rate: 44100,
    };
    expect(sampleRecord).toBeDefined();
    expect(sampleRecord.kit_name).toBe("test-kit");

    const kitRecord: Kit = {
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      name: "test-kit",
      step_pattern: null,
    };
    expect(kitRecord).toBeDefined();

    const voiceRecord: Voice = {
      id: 1,
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

    const dbResult: DbResult<Sample[]> = {
      data: [sampleRecord],
      success: true,
    };
    expect(dbResult).toBeDefined();
  });
});

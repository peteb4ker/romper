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
      id: 1,
      kit_name: "test-kit",
      filename: "test.wav",
      voice_number: 1,
      slot_number: 1,
      source_path: "/path/to/test.wav",
      is_stereo: false,
      wav_bitrate: 16,
      wav_sample_rate: 44100,
    };
    expect(sampleRecord).toBeDefined();
    expect(sampleRecord.kit_name).toBe("test-kit");

    const kitRecord: Kit = {
      name: "test-kit",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
    };
    expect(kitRecord).toBeDefined();

    const voiceRecord: Voice = {
      id: 1,
      kit_name: "test-kit",
      voice_number: 1,
      voice_alias: "Kicks",
    };
    expect(voiceRecord).toBeDefined();

    const kitValidationError: KitValidationError = {
      kitName: "test-kit",
      missingFiles: ["missing.wav"],
      extraFiles: ["extra.wav"],
    };
    expect(kitValidationError).toBeDefined();

    const validationDetailedResult: LocalStoreValidationDetailedResult = {
      isValid: false,
      errors: [kitValidationError],
      errorSummary: "Test error",
    };
    expect(validationDetailedResult).toBeDefined();

    const dbResult: DbResult<Sample[]> = {
      success: true,
      data: [sampleRecord],
    };
    expect(dbResult).toBeDefined();
  });
});

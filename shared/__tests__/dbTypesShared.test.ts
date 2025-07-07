import { describe, expect, it } from "vitest";

import {
  DbResult,
  KitRecord,
  KitValidationError,
  KitWithVoices,
  LocalStoreValidationDetailedResult,
  LocalStoreValidationResult,
  SampleRecord,
  VoiceRecord,
} from "../dbTypesShared";

describe("dbTypesShared", () => {
  it("should export all required interfaces", () => {
    // This test simply verifies that all interfaces are exported correctly
    // by checking that they can be imported and used to create objects

    const sampleRecord: SampleRecord = {
      kit_name: "test-kit",
      filename: "test.wav",
      voice_number: 1,
      slot_number: 1,
      is_stereo: false,
      wav_bitrate: 16,
      wav_sample_rate: 44100,
    };
    expect(sampleRecord).toBeDefined();
    expect(sampleRecord.kit_name).toBe("test-kit");

    const kitRecord: KitRecord = {
      name: "test-kit",
      plan_enabled: false,
    };
    expect(kitRecord).toBeDefined();

    const voiceRecord: VoiceRecord = {
      kit_name: "test-kit",
      voice_number: 1,
      voice_alias: "Kicks",
    };
    expect(voiceRecord).toBeDefined();

    const kitWithVoices: KitWithVoices = {
      name: "test-kit",
      plan_enabled: false,
      locked: false,
      voices: { 1: "Kicks", 2: "Snares", 3: "Hats", 4: "Percs" },
    };
    expect(kitWithVoices).toBeDefined();

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

    const validationResult: LocalStoreValidationResult = {
      isValid: false,
      error: "Test error",
      romperDbPath: "/test/path",
    };
    expect(validationResult).toBeDefined();

    const dbResult: DbResult<SampleRecord[]> = {
      success: true,
      data: [sampleRecord],
    };
    expect(dbResult).toBeDefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  encodeStepPatternToBlob,
  decodeStepPatternFromBlob,
  STEP_PATTERN_STEPS,
  STEP_PATTERN_VOICES,
  STEP_PATTERN_BLOB_SIZE,
  MAX_VELOCITY,
} from "../stepPatternUtils";

describe("stepPatternUtils", () => {
  describe("constants", () => {
    it("should have correct constant values", () => {
      expect(STEP_PATTERN_STEPS).toBe(16);
      expect(STEP_PATTERN_VOICES).toBe(4);
      expect(STEP_PATTERN_BLOB_SIZE).toBe(64);
      expect(MAX_VELOCITY).toBe(127);
    });
  });

  describe("encodeStepPatternToBlob", () => {
    it("should encode a 4-voice x 16-step pattern to 64-byte BLOB", () => {
      const stepPattern = [
        [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const blob = encodeStepPatternToBlob(stepPattern);

      expect(blob).toBeInstanceOf(Uint8Array);
      expect(blob?.length).toBe(64);
      expect(blob?.[0]).toBe(100); // step 0, voice 0
      expect(blob?.[1]).toBe(0);   // step 0, voice 1
      expect(blob?.[2]).toBe(0);   // step 0, voice 2
      expect(blob?.[3]).toBe(0);   // step 0, voice 3
      expect(blob?.[4]).toBe(0);   // step 1, voice 0
      expect(blob?.[5]).toBe(80);  // step 1, voice 1
    });

    it("should handle null/undefined input", () => {
      expect(encodeStepPatternToBlob(null)).toBeNull();
      expect(encodeStepPatternToBlob(undefined)).toBeNull();
      expect(encodeStepPatternToBlob([])).toBeNull();
    });

    it("should clamp velocity values to 0-127 range", () => {
      const stepPattern = [
        [200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // voice 0: step 0 = 200
        [-50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // voice 1: step 0 = -50
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],   // voice 2: step 0 = 0
        [127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // voice 3: step 0 = 127
      ];

      const blob = encodeStepPatternToBlob(stepPattern);

      expect(blob?.[0]).toBe(127); // 200 clamped to 127
      expect(blob?.[1]).toBe(0);   // -50 clamped to 0
      expect(blob?.[2]).toBe(0);   // 0 unchanged
      expect(blob?.[3]).toBe(127); // 127 unchanged
    });
  });

  describe("decodeStepPatternFromBlob", () => {
    it("should decode a 64-byte BLOB to 4-voice x 16-step pattern", () => {
      const blob = new Uint8Array(64);
      blob[0] = 100; // step 0, voice 0
      blob[5] = 80;  // step 1, voice 1
      blob[10] = 60; // step 2, voice 2
      blob[15] = 40; // step 3, voice 3

      const stepPattern = decodeStepPatternFromBlob(blob);

      expect(stepPattern).toHaveLength(4);
      expect(stepPattern?.[0]).toHaveLength(16);
      expect(stepPattern?.[0][0]).toBe(100);
      expect(stepPattern?.[1][1]).toBe(80);
      expect(stepPattern?.[2][2]).toBe(60);
      expect(stepPattern?.[3][3]).toBe(40);
    });

    it("should handle null input", () => {
      expect(decodeStepPatternFromBlob(null)).toBeNull();
    });

    it("should handle invalid BLOB size", () => {
      const invalidBlob = new Uint8Array(32); // Wrong size
      expect(decodeStepPatternFromBlob(invalidBlob)).toBeNull();
    });
  });

  describe("round-trip encoding/decoding", () => {
    it("should preserve data through encode/decode cycle", () => {
      const originalPattern = [
        [100, 0, 50, 0, 75, 0, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 80, 0, 60, 0, 40, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 90, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 95, 0, 0, 0, 85, 0, 0, 0, 0, 0, 0, 0, 0],
      ];

      const blob = encodeStepPatternToBlob(originalPattern);
      const decodedPattern = decodeStepPatternFromBlob(blob);

      expect(decodedPattern).toEqual(originalPattern);
    });
  });
});

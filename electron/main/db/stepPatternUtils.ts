// Step pattern encoding/decoding utilities for BLOB storage
// Constants for step pattern encoding
export const STEP_PATTERN_STEPS = 16;
export const STEP_PATTERN_VOICES = 4;
export const STEP_PATTERN_BLOB_SIZE = STEP_PATTERN_STEPS * STEP_PATTERN_VOICES; // 64 bytes
export const MAX_VELOCITY = 127;

export function decodeStepPatternFromBlob(
  blob: null | Uint8Array,
): null | number[][] {
  if (!blob || blob.length !== STEP_PATTERN_BLOB_SIZE) {
    return null;
  }

  // Create 4 voices x 16 steps pattern
  const stepPattern: number[][] = Array(STEP_PATTERN_VOICES)
    .fill(0)
    .map(() => Array(STEP_PATTERN_STEPS));

  for (let step = 0; step < STEP_PATTERN_STEPS; step++) {
    for (let voice = 0; voice < STEP_PATTERN_VOICES; voice++) {
      const index = step * STEP_PATTERN_VOICES + voice;
      stepPattern[voice][step] = blob[index];
    }
  }

  return stepPattern;
}

/**
 * Encodes a step pattern to a BLOB for database storage.
 * Each step pattern is stored as 64 bytes (16 steps x 4 voices)
 * Each byte represents velocity (0-127) for that step/voice combination
 * Layout: [step0_voice0, step0_voice1, step0_voice2, step0_voice3, step1_voice0, step1_voice1, ...]
 */
export function encodeStepPatternToBlob(
  stepPattern: null | number[][] | undefined,
): null | Uint8Array {
  if (!stepPattern || stepPattern.length === 0) {
    return null;
  }

  const blob = new Uint8Array(STEP_PATTERN_BLOB_SIZE);

  for (let step = 0; step < STEP_PATTERN_STEPS; step++) {
    for (let voice = 0; voice < STEP_PATTERN_VOICES; voice++) {
      const index = step * STEP_PATTERN_VOICES + voice;
      const velocity = stepPattern[voice]?.[step] || 0;
      // Ensure velocity is within valid range (0-127)
      blob[index] = Math.max(0, Math.min(MAX_VELOCITY, velocity));
    }
  }

  return blob;
}

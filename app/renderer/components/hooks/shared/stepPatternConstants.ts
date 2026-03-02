// Shared constants for step patterns and sequencer
export const NUM_VOICES = 4;
export const NUM_STEPS = 16;

// Shared interface for step focus
export interface FocusedStep {
  step: number;
  voice: number;
}

// UI styling constants for sequencer
export const ROW_COLORS = [
  "bg-voice-1 border-voice-1", // Row 0 (Voice 1)
  "bg-voice-2 border-voice-2", // Row 1 (Voice 2)
  "bg-voice-3 border-voice-3", // Row 2 (Voice 3)
  "bg-voice-4 border-voice-4", // Row 3 (Voice 4)
];

export const LED_GLOWS = [
  "shadow-[0_0_12px_3px_rgba(224,90,96,0.7)]", // voice-1 coral-red
  "shadow-[0_0_12px_3px_rgba(61,170,120,0.7)]", // voice-2 green
  "shadow-[0_0_12px_3px_rgba(58,159,212,0.7)]", // voice-3 blue
  "shadow-[0_0_12px_3px_rgba(232,200,70,0.7)]", // voice-4 golden-yellow
];

/**
 * Creates a default empty step pattern (4 voices x 16 steps, all velocity 0)
 */
export function createDefaultStepPattern(): number[][] {
  return Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(0));
}

/**
 * Ensures a step pattern is valid, returning default if invalid
 */
export function ensureValidStepPattern(
  pattern: null | number[][] | undefined,
): number[][] {
  if (!pattern || !isValidStepPattern(pattern)) {
    return createDefaultStepPattern();
  }
  return pattern;
}

/**
 * Validates if a step pattern has the correct structure
 */
export function isValidStepPattern(pattern: unknown): pattern is number[][] {
  return (
    Array.isArray(pattern) &&
    pattern.length === NUM_VOICES &&
    pattern.every((row) => Array.isArray(row) && row.length === NUM_STEPS)
  );
}

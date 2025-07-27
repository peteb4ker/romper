// Shared constants for step patterns and sequencer
export const NUM_VOICES = 4;
export const NUM_STEPS = 16;

// Shared interface for step focus
export interface FocusedStep {
  voice: number;
  step: number;
}

// UI styling constants for sequencer
export const ROW_COLORS = [
  "bg-red-500 border-red-700", // Row 0 (Voice 1)
  "bg-green-500 border-green-700", // Row 1 (Voice 2)
  "bg-yellow-400 border-yellow-600", // Row 2 (Voice 3)
  "bg-purple-500 border-purple-700", // Row 3 (Voice 4)
];

export const LED_GLOWS = [
  "shadow-[0_0_12px_3px_rgba(239,68,68,0.7)]", // red
  "shadow-[0_0_12px_3px_rgba(34,197,94,0.7)]", // green
  "shadow-[0_0_12px_3px_rgba(234,179,8,0.7)]", // yellow
  "shadow-[0_0_12px_3px_rgba(168,85,247,0.7)]", // purple
];

/**
 * Creates a default empty step pattern (4 voices x 16 steps, all velocity 0)
 */
export function createDefaultStepPattern(): number[][] {
  return Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(0));
}

/**
 * Validates if a step pattern has the correct structure
 */
export function isValidStepPattern(pattern: any): pattern is number[][] {
  return (
    Array.isArray(pattern) &&
    pattern.length === NUM_VOICES &&
    pattern.every((row) => Array.isArray(row) && row.length === NUM_STEPS)
  );
}

/**
 * Ensures a step pattern is valid, returning default if invalid
 */
export function ensureValidStepPattern(
  pattern: number[][] | null | undefined,
): number[][] {
  if (!pattern || !isValidStepPattern(pattern)) {
    return createDefaultStepPattern();
  }
  return pattern;
}

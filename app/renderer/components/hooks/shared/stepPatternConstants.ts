// Shared constants for step patterns and sequencer
export const NUM_VOICES = 4;
export const NUM_STEPS = 16;

// Sample selection modes for voices with multiple samples
export type SampleMode = "first" | "random" | "round-robin";
export const SAMPLE_MODE_LABELS: Record<SampleMode, string> = {
  first: "1st",
  random: "Rnd",
  "round-robin": "R-R",
};

// Trigger conditions for step sequencer A:B patterns
export type TriggerCondition =
  | "1:2"
  | "1:4"
  | "2:2"
  | "2:4"
  | "3:4"
  | "4:4"
  | null;

// Ordered array for cycling through conditions via right-click
export const TRIGGER_CONDITIONS: TriggerCondition[] = [
  null,
  "1:2",
  "2:2",
  "1:4",
  "2:4",
  "3:4",
  "4:4",
];

// Shared interface for step focus
export interface FocusedStep {
  step: number;
  voice: number;
}

/**
 * Creates a default trigger conditions array (4 voices x 16 steps, all null)
 */
export function createDefaultTriggerConditions(): (null | string)[][] {
  return Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(null));
}

/**
 * Ensures trigger conditions are valid, returning default if invalid
 */
export function ensureValidTriggerConditions(
  conditions: (null | string)[][] | null | undefined,
): (null | string)[][] {
  if (
    !conditions ||
    !Array.isArray(conditions) ||
    conditions.length !== NUM_VOICES ||
    !conditions.every((row) => Array.isArray(row) && row.length === NUM_STEPS)
  ) {
    return createDefaultTriggerConditions();
  }
  return conditions;
}

/**
 * Returns true if the step should trigger on this cycle.
 * null = always trigger. "A:B" = trigger when (cycleCount % B) + 1 === A.
 */
export function shouldTrigger(
  condition: TriggerCondition,
  cycleCount: number,
): boolean {
  if (condition === null) return true;
  const [aStr, bStr] = condition.split(":");
  const a = parseInt(aStr, 10);
  const b = parseInt(bStr, 10);
  return (cycleCount % b) + 1 === a;
}

// UI styling constants for sequencer
export const ROW_COLORS = [
  "bg-voice-1 border-voice-1", // Row 0 (Voice 1)
  "bg-voice-2 border-voice-2", // Row 1 (Voice 2)
  "bg-voice-3 border-voice-3", // Row 2 (Voice 3)
  "bg-voice-4 border-voice-4", // Row 3 (Voice 4)
];

export const LED_GLOWS = [
  "shadow-[0_0_12px_3px_rgba(224,90,96,0.7)]", // voice-1 red
  "shadow-[0_0_12px_3px_rgba(232,200,70,0.7)]", // voice-2 yellow
  "shadow-[0_0_12px_3px_rgba(61,170,120,0.7)]", // voice-3 green
  "shadow-[0_0_12px_3px_rgba(58,159,212,0.7)]", // voice-4 blue
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

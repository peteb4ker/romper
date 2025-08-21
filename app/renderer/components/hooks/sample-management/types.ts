// Reusable type definitions for sample management operations

import type { Sample } from "@romper/shared/db/schema.js";

export interface MoveOperationResult {
  data?: {
    affectedSamples: SampleWithOriginalSlot[];
    movedSample: Sample;
    replacedSample?: Sample;
  };
  error?: string;
  success: boolean;
}

// Generic operation result type for undo/redo operations
export interface OperationResult {
  data?: unknown;
  error?: string;
  success: boolean;
}

type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

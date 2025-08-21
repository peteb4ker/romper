// Reusable type definitions for sample management operations

import type { Sample } from "@romper/shared/db/schema.js";

type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

export interface MoveOperationResult {
  success: boolean;
  data?: {
    movedSample: Sample;
    affectedSamples: SampleWithOriginalSlot[];
    replacedSample?: Sample;
  };
  error?: string;
}

// Generic operation result type for undo/redo operations
export interface OperationResult {
  success: boolean;
  error?: string;
  data?: unknown;
}
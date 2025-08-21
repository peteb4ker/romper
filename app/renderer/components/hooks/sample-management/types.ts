// Reusable type definitions for sample management operations

import type { Sample } from "@romper/shared/db/schema.js";

export interface MoveOperationResult {
  success: boolean;
  data?: {
    movedSample: Sample;
    affectedSamples: Sample[];
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
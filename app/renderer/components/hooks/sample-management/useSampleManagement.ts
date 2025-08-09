import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { useSampleManagementMoveOps } from "./useSampleManagementMoveOps";
import { useSampleManagementOperations } from "./useSampleManagementOperations";

export interface UseSampleManagementParams {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void; // Callback to add undo actions
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSamplesChanged?: () => Promise<void>; // Callback to reload samples/kit data
  skipUndoRecording?: boolean; // Skip recording actions (used during undo operations)
}

/**
 * Hook for managing sample add/replace/delete operations with source_path tracking
 * Implements Task 5.2.2 & 5.2.3: Drag-and-drop sample assignment and operations
 */
export function useSampleManagement({
  kitName,
  onAddUndoAction,
  onMessage,
  onSamplesChanged,
  skipUndoRecording = false,
}: UseSampleManagementParams) {
  // Basic sample operations hook
  const operations = useSampleManagementOperations({
    kitName,
    onAddUndoAction,
    onMessage,
    onSamplesChanged,
    skipUndoRecording,
  });

  // Move operations hook
  const moveOps = useSampleManagementMoveOps({
    kitName,
    onAddUndoAction,
    onMessage,
    onSamplesChanged,
    skipUndoRecording,
  });

  return {
    handleSampleAdd: operations.handleSampleAdd,
    handleSampleDelete: operations.handleSampleDelete,
    handleSampleMove: moveOps.handleSampleMove,
    handleSampleReplace: operations.handleSampleReplace,
  };
}

import type { KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { useSampleManagementMoveOps } from "./useSampleManagementMoveOps";
import { useSampleManagementOperations } from "./useSampleManagementOperations";

export interface UseSampleManagementParams {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void; // Callback to add undo actions
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Shows the kit after a sample edit: as the edit returned it, or read again (#452) */
  onSamplesChanged?: (edited?: KitWithRelations) => Promise<void>;
  skipUndoRecording?: boolean; // Skip recording actions (used during undo operations)
}

/**
 * Hook for managing sample add/move/delete operations with source_path tracking
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
  };
}

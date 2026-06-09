import { useRef, useState } from "react";

export type DeleteSummary = { locked: boolean; sampleCount: number };

export type DuplicateKitFn = (
  source: string,
  dest: string,
) => Promise<{ error?: string }>;

export type RequestDeleteSummaryFn = (
  kitName: string,
) => Promise<DeleteSummary | null>;

const EXIT_ANIMATION_MS = 250;

interface UseKitItemActionsParams {
  kitName: string;
  onDelete?: () => void;
  onDeleteKit?: (kitName: string) => Promise<void>;
  onDuplicate: () => void;
  onDuplicateKit?: DuplicateKitFn;
  onRequestDeleteSummary?: RequestDeleteSummaryFn;
}

/**
 * Delete/duplicate action state for a kit browser item: the confirmation
 * popover state machines, the exit animation on confirmed delete, and the
 * legacy no-popover fallbacks (plain onDelete / onDuplicate).
 */
export function useKitItemActions({
  kitName,
  onDelete,
  onDeleteKit,
  onDuplicate,
  onDuplicateKit,
  onRequestDeleteSummary,
}: UseKitItemActionsParams) {
  // Exit animation state (plays before the item unmounts on delete)
  const [isExiting, setIsExiting] = useState(false);

  // Delete popover state
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [showDeletePopover, setShowDeletePopover] = useState(false);
  const [deleteSampleCount, setDeleteSampleCount] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate popover state
  const duplicateButtonRef = useRef<HTMLButtonElement>(null);
  const [showDuplicatePopover, setShowDuplicatePopover] = useState(false);
  const [duplicateDest, setDuplicateDest] = useState("");
  const [duplicateError, setDuplicateError] = useState<null | string>(null);

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRequestDeleteSummary) {
      onDelete?.();
      return;
    }
    const summary = await onRequestDeleteSummary(kitName);
    if (!summary) return;
    setDeleteSampleCount(summary.sampleCount);
    setShowDeletePopover(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteKit) return;
    setIsDeleting(true);
    try {
      setShowDeletePopover(false);
      setIsExiting(true);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, EXIT_ANIMATION_MS);
      });
      await onDeleteKit(kitName);
    } catch {
      // Only reset if deletion failed — component stays mounted
      setIsDeleting(false);
      setIsExiting(false);
    }
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDuplicateKit) {
      onDuplicate();
      return;
    }
    setDuplicateDest("");
    setDuplicateError(null);
    setShowDuplicatePopover(true);
  };

  const handleConfirmDuplicate = async () => {
    if (!onDuplicateKit) return;
    const result = await onDuplicateKit(kitName, duplicateDest);
    if (result.error) {
      setDuplicateError(result.error);
      return;
    }
    setShowDuplicatePopover(false);
    setDuplicateDest("");
    setDuplicateError(null);
  };

  const closeDeletePopover = () => setShowDeletePopover(false);

  const closeDuplicatePopover = () => {
    setShowDuplicatePopover(false);
    setDuplicateError(null);
  };

  return {
    closeDeletePopover,
    closeDuplicatePopover,
    deleteButtonRef,
    deleteSampleCount,
    duplicateButtonRef,
    duplicateDest,
    duplicateError,
    handleConfirmDelete,
    handleConfirmDuplicate,
    handleDeleteClick,
    handleDuplicateClick,
    isDeleting,
    isExiting,
    setDuplicateDest,
    showDeletePopover,
    showDuplicatePopover,
  };
}

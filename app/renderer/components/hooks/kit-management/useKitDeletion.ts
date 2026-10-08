import { useCallback, useState } from "react";

import {
  deleteKit,
  formatKitOperationError,
  getKitDeleteSummary,
} from "../../utils/kitOperations";

interface UseKitDeletionProps {
  /** Takes the deleted kit off the list without reading every kit (#452) */
  onKitDeleted?: (kitName: string) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => void;
}

export function useKitDeletion({
  onKitDeleted,
  onMessage,
  onRefreshKits,
}: UseKitDeletionProps) {
  // The list without the deleted kit: taken off, or else read again
  const showDeleted = useCallback(
    (kitName: string) => {
      if (onKitDeleted) onKitDeleted(kitName);
      else onRefreshKits?.();
    },
    [onKitDeleted, onRefreshKits],
  );

  const [kitToDelete, setKitToDelete] = useState<null | string>(null);
  const [deleteSummary, setDeleteSummary] = useState<{
    sampleCount: number;
    voiceCount: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRequestDelete = async (kitName: string) => {
    try {
      const summary = await getKitDeleteSummary(kitName);
      if (summary.locked) {
        onMessage?.(
          "Kit is locked. Unlock it before deleting.",
          "warning",
          4000,
        );
        return;
      }
      setDeleteSummary({
        sampleCount: summary.sampleCount,
        voiceCount: summary.voiceCount,
      });
      setKitToDelete(kitName);
    } catch (err) {
      onMessage?.(formatKitOperationError(err, "delete"), "error", 5000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!kitToDelete) return;
    setIsDeleting(true);
    try {
      await deleteKit(kitToDelete);
      // Success feedback handled by exit animation — no toast needed
      showDeleted(kitToDelete);
    } catch (err) {
      onMessage?.(formatKitOperationError(err, "delete"), "error", 5000);
    } finally {
      setIsDeleting(false);
      setKitToDelete(null);
      setDeleteSummary(null);
    }
  };

  const handleCancelDelete = () => {
    setKitToDelete(null);
    setDeleteSummary(null);
  };

  // Stable, like deleteKitDirect: both reach every memoized kit card (#462)
  const requestDeleteSummary = useCallback(
    async (
      kitName: string,
    ): Promise<{ locked: boolean; sampleCount: number } | null> => {
      try {
        const summary = await getKitDeleteSummary(kitName);
        if (summary.locked) {
          onMessage?.(
            "Kit is locked. Unlock it before deleting.",
            "warning",
            4000,
          );
          return null;
        }
        return { locked: false, sampleCount: summary.sampleCount };
      } catch (err) {
        onMessage?.(formatKitOperationError(err, "delete"), "error", 5000);
        return null;
      }
    },
    [onMessage],
  );

  const deleteKitDirect = useCallback(
    async (kitName: string): Promise<void> => {
      try {
        await deleteKit(kitName);
        // Success feedback handled by exit animation — no toast needed
        showDeleted(kitName);
      } catch (err) {
        onMessage?.(formatKitOperationError(err, "delete"), "error", 5000);
        // Rethrow so the caller (KitGridItem) can roll back its exit animation —
        // otherwise a failed delete leaves the card looking deleted.
        throw err;
      }
    },
    [onMessage, showDeleted],
  );

  return {
    deleteKitDirect,
    deleteSummary,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestDelete,
    isDeleting,
    kitToDelete,
    requestDeleteSummary,
  };
}

import { useState } from "react";

import {
  deleteKit,
  formatKitOperationError,
  getKitDeleteSummary,
} from "../../utils/kitOperations";

interface UseKitDeletionProps {
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => void;
}

export function useKitDeletion({
  onMessage,
  onRefreshKits,
}: UseKitDeletionProps) {
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
      onMessage?.(`Kit ${kitToDelete} deleted.`, "info", 4000);
      onRefreshKits?.();
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

  return {
    deleteSummary,
    handleCancelDelete,
    handleConfirmDelete,
    handleRequestDelete,
    isDeleting,
    kitToDelete,
  };
}

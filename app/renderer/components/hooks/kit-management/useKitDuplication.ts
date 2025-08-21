import { useState } from "react";

import { duplicateKit, validateKitSlot } from "../../utils/kitOperations";

interface UseKitDuplicationProps {
  onRefreshKits?: (scrollToKit?: string) => void;
}

export function useKitDuplication({ onRefreshKits }: UseKitDuplicationProps) {
  const [duplicateKitSource, setDuplicateKitSource] = useState<null | string>(
    null,
  );
  const [duplicateKitDest, setDuplicateKitDest] = useState("");
  const [duplicateKitError, setDuplicateKitError] = useState<null | string>(
    null,
  );

  const handleDuplicateKit = async () => {
    setDuplicateKitError(null);
    if (!duplicateKitSource || !validateKitSlot(duplicateKitDest)) {
      setDuplicateKitError("Invalid destination slot. Use format A0-Z99.");
      return;
    }

    try {
      await duplicateKit(duplicateKitSource, duplicateKitDest);

      // Scan the newly created kit to populate voice names and metadata
      if (window.electronAPI?.rescanKit) {
        try {
          await window.electronAPI.rescanKit(duplicateKitDest);
        } catch (scanError) {
          console.warn(
            "Failed to scan newly duplicated kit:",
            duplicateKitDest,
            scanError,
          );
          // Don't fail the whole operation if scanning fails
        }
      }

      const kitNameToScrollTo = duplicateKitDest;
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
    } catch (err) {
      setDuplicateKitError(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    duplicateKitDest,
    duplicateKitError,
    // State
    duplicateKitSource,

    // Actions
    handleDuplicateKit,

    setDuplicateKitDest,
    setDuplicateKitError,
    // Setters
    setDuplicateKitSource,
  };
}

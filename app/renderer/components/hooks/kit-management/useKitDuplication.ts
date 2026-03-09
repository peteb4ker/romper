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

      const kitNameToScrollTo = duplicateKitDest;
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
    } catch (err) {
      setDuplicateKitError(err instanceof Error ? err.message : String(err));
    }
  };

  const duplicateKitDirect = async (
    source: string,
    dest: string,
  ): Promise<{ error?: string }> => {
    if (!validateKitSlot(dest)) {
      return { error: "Invalid destination slot. Use format A0-Z99." };
    }
    try {
      await duplicateKit(source, dest);
      if (onRefreshKits) onRefreshKits(dest);
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };

  return {
    duplicateKitDest,
    duplicateKitDirect,
    duplicateKitError,
    duplicateKitSource,
    handleDuplicateKit,
    setDuplicateKitDest,
    setDuplicateKitError,
    setDuplicateKitSource,
  };
}

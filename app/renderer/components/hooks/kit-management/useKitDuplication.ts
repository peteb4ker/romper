import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback, useEffect, useRef, useState } from "react";

import { duplicateKit, validateKitSlot } from "../../utils/kitOperations";

interface UseKitDuplicationProps {
  /** Shows the list with the copy: the kit main returned, or a reload */
  onRefreshKits?: (scrollToKit?: string, created?: KitWithRelations) => void;
}

const ANIMATION_CLEAR_MS = 1000;

export function useKitDuplication({ onRefreshKits }: UseKitDuplicationProps) {
  const [duplicateKitSource, setDuplicateKitSource] = useState<null | string>(
    null,
  );
  const [duplicateKitDest, setDuplicateKitDest] = useState("");
  const [duplicateKitError, setDuplicateKitError] = useState<null | string>(
    null,
  );
  const [newlyDuplicatedKit, setNewlyDuplicatedKit] = useState<null | string>(
    null,
  );
  const clearTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const trackNewKit = useCallback((kitName: string) => {
    setNewlyDuplicatedKit(kitName);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(
      () => setNewlyDuplicatedKit(null),
      ANIMATION_CLEAR_MS,
    );
  }, []);

  const handleDuplicateKit = async () => {
    setDuplicateKitError(null);
    if (!duplicateKitSource || !validateKitSlot(duplicateKitDest)) {
      setDuplicateKitError("Invalid destination slot. Use format A0-Z99.");
      return;
    }

    try {
      const created = await duplicateKit(duplicateKitSource, duplicateKitDest);

      const kitNameToScrollTo = duplicateKitDest;
      trackNewKit(kitNameToScrollTo);
      setDuplicateKitSource(null);
      setDuplicateKitDest("");
      if (onRefreshKits) onRefreshKits(kitNameToScrollTo, created);
    } catch (err) {
      setDuplicateKitError(err instanceof Error ? err.message : String(err));
    }
  };

  // Stable, since it reaches every memoized kit card (#462)
  const duplicateKitDirect = useCallback(
    async (source: string, dest: string): Promise<{ error?: string }> => {
      if (!validateKitSlot(dest)) {
        return { error: "Invalid destination slot. Use format A0-Z99." };
      }
      try {
        const created = await duplicateKit(source, dest);
        trackNewKit(dest);
        if (onRefreshKits) onRefreshKits(dest, created);
        return {};
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
    [onRefreshKits, trackNewKit],
  );

  return {
    duplicateKitDest,
    duplicateKitDirect,
    duplicateKitError,
    duplicateKitSource,
    handleDuplicateKit,
    newlyDuplicatedKit,
    setDuplicateKitDest,
    setDuplicateKitError,
    setDuplicateKitSource,
  };
}

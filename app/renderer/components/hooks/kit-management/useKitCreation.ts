import type { KitWithRelations } from "@romper/shared/db/schema";

import { getNextSlotInBank } from "@romper/shared/kitUtilsShared";
import { useCallback, useEffect, useRef, useState } from "react";

import { markExplicitNavigation } from "../../../utils/hmrStateManager";
import { createKit, formatKitError } from "../../utils/kitOperations";

interface UseKitCreationProps {
  kits: KitWithRelations[];
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: (scrollToKit?: string) => void;
}

const ANIMATION_CLEAR_MS = 1000;

export function useKitCreation({
  kits,
  onMessage,
  onRefreshKits,
}: UseKitCreationProps) {
  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [newlyCreatedKit, setNewlyCreatedKit] = useState<null | string>(null);
  const clearTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleCreateKitInBank = useCallback(
    async (bankLetter: string) => {
      const existingNames = kits.map((kit) => kit.name);
      const nextSlot = getNextSlotInBank(bankLetter, existingNames);

      if (!nextSlot) {
        if (onMessage) onMessage(`Bank ${bankLetter} is full`, "warning", 4000);
        return;
      }

      setIsCreatingKit(true);
      try {
        await createKit(nextSlot);

        // Mark as explicit navigation to prevent HMR from restoring previous kit
        markExplicitNavigation();

        // Track newly created kit for entrance animation
        setNewlyCreatedKit(nextSlot);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(
          () => setNewlyCreatedKit(null),
          ANIMATION_CLEAR_MS,
        );

        if (onRefreshKits) onRefreshKits(nextSlot);
      } catch (err) {
        if (onMessage) onMessage(formatKitError(err), "error", 5000);
      } finally {
        setIsCreatingKit(false);
      }
    },
    [kits, onMessage, onRefreshKits],
  );

  return {
    handleCreateKitInBank,
    isCreatingKit,
    newlyCreatedKit,
  };
}

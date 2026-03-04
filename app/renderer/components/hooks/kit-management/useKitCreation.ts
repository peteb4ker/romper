import type { KitWithRelations } from "@romper/shared/db/schema";

import { getNextSlotInBank } from "@romper/shared/kitUtilsShared";
import { useState } from "react";

import { markExplicitNavigation } from "../../../utils/hmrStateManager";
import { createKit, formatKitError } from "../../utils/kitOperations";

interface UseKitCreationProps {
  kits: KitWithRelations[];
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: (scrollToKit?: string) => void;
}

export function useKitCreation({
  kits,
  onMessage,
  onRefreshKits,
}: UseKitCreationProps) {
  const [isCreatingKit, setIsCreatingKit] = useState(false);

  const handleCreateKitInBank = async (bankLetter: string) => {
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

      if (onRefreshKits) onRefreshKits(nextSlot);
      if (onMessage)
        onMessage(`Kit ${nextSlot} created successfully!`, "info", 4000);
    } catch (err) {
      if (onMessage) onMessage(formatKitError(err), "error", 5000);
    } finally {
      setIsCreatingKit(false);
    }
  };

  return {
    handleCreateKitInBank,
    isCreatingKit,
  };
}

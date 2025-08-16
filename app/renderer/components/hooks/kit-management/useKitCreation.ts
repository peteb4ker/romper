import type { KitWithRelations } from "@romper/shared/db/schema";

import { getNextKitSlot } from "@romper/shared/kitUtilsShared";
import { useEffect, useState } from "react";

import { markExplicitNavigation } from "../../../utils/hmrStateManager";
import {
  createKit,
  formatKitError,
  validateKitSlot,
} from "../../utils/kitOperations";

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
  // New kit dialog state
  const [showNewKit, setShowNewKit] = useState(false);
  const [newKitSlot, setNewKitSlot] = useState("");
  const [newKitError, setNewKitError] = useState<null | string>(null);

  // Next kit slot calculation
  const [nextKitSlot, setNextKitSlot] = useState<null | string>(null);

  // Calculate next available kit slot when kits change
  useEffect(() => {
    const kitNames = kits.map((kit) => kit.name);
    setNextKitSlot(getNextKitSlot(kitNames));
  }, [kits]);

  const handleCreateKit = async () => {
    setNewKitError(null);
    if (!validateKitSlot(newKitSlot)) {
      setNewKitError("Invalid kit slot. Use format A0-Z99.");
      return;
    }

    try {
      await createKit(newKitSlot);
      const kitNameToScrollTo = newKitSlot;
      setShowNewKit(false);
      setNewKitSlot("");

      // Mark as explicit navigation to prevent HMR from restoring previous kit
      markExplicitNavigation();

      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
      if (onMessage)
        onMessage(`Kit ${newKitSlot} created successfully!`, "info", 4000);
    } catch (err) {
      setNewKitError(formatKitError(err));
    }
  };

  const handleCreateNextKit = async () => {
    setNewKitError(null);
    if (!nextKitSlot || !validateKitSlot(nextKitSlot)) {
      setNewKitError("No next kit slot available.");
      return;
    }

    try {
      await createKit(nextKitSlot);
      const kitNameToScrollTo = nextKitSlot;

      // Mark as explicit navigation to prevent HMR from restoring previous kit
      markExplicitNavigation();

      if (onRefreshKits) onRefreshKits(kitNameToScrollTo);
    } catch (err) {
      setNewKitError(formatKitError(err));
    }
  };

  return {
    // Actions
    handleCreateKit,
    handleCreateNextKit,
    newKitError,
    newKitSlot,

    nextKitSlot,
    setNewKitError,

    setNewKitSlot,
    // Setters (for external control)
    setShowNewKit,
    // State
    showNewKit,
  };
}

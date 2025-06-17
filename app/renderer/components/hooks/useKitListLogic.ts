import { useMemo } from "react";

import type { RampleKitLabel } from "../KitDetails";
import { compareKitSlots } from "../../../../shared/kitUtilsShared";

export function useKitListLogic(kits: string[]) {
  // Sorted and filtered kits for display
  const kitsToDisplay = useMemo(
    () => (kits.length > 0 ? kits.slice().sort(compareKitSlots) : []),
    [kits],
  );

  // Helper to determine if a kit is valid
  const isValidKit = (kit: string) => /^[A-Z][0-9]{1,2}$/.test(kit);

  // Helper to get color class
  const getColorClass = (kit: string) =>
    isValidKit(kit) ? "text-gray-600 dark:text-gray-300" : "text-red-500";

  // Helper to determine if a bank anchor should be shown
  const showBankAnchor = (kit: string, idx: number, arr: string[]) =>
    isValidKit(kit) && (idx === 0 || arr[idx - 1][0] !== kit[0]);

  return {
    kitsToDisplay,
    isValidKit,
    getColorClass,
    showBankAnchor,
  };
}

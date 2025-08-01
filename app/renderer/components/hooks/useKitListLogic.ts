import { useMemo } from "react";

import type { KitWithRelations } from "../../../../shared/db/schema";
import { compareKitSlots } from "../../../../shared/kitUtilsShared";

export function useKitListLogic(kits: KitWithRelations[]) {
  // Sorted and filtered kits for display
  const kitsToDisplay = useMemo(
    () =>
      kits.length > 0
        ? kits.slice().sort((a, b) => compareKitSlots(a.name, b.name))
        : [],
    [kits],
  );

  // Helper to determine if a kit is valid
  const isValidKit = (kit: KitWithRelations) =>
    /^[A-Z]\d{1,2}$/.test(kit.name);

  // Helper to get color class
  const getColorClass = (kit: KitWithRelations) =>
    isValidKit(kit) ? "text-gray-600 dark:text-gray-300" : "text-red-500";

  // Helper to determine if a bank anchor should be shown
  const showBankAnchor = (
    kit: KitWithRelations,
    idx: number,
    arr: KitWithRelations[],
  ) => isValidKit(kit) && (idx === 0 || !kit.name.startsWith(arr[idx - 1].name[0]));

  return {
    kitsToDisplay,
    isValidKit,
    getColorClass,
    showBankAnchor,
  };
}

import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback, useState } from "react";

export function useKitListNavigation(
  kits: KitWithRelations[],
  focusedKit: null | string,
) {
  // The focused index, and the index the last external focus moved it to
  // (null once the user navigates), so an unchanged external focus doesn't
  // pull focus back from where the user moved it
  const [nav, setNav] = useState<{
    focusedIdx: number;
    lastExternalIdx: null | number;
  }>({ focusedIdx: 0, lastExternalIdx: null });

  // Move focus by delta (row/col navigation)
  const moveFocus = useCallback(
    (delta: number) => {
      setNav(({ focusedIdx: idx }) => {
        let next = idx + delta;
        if (next >= kits.length) next = kits.length - 1;
        if (next < 0) next = 0; // also with no kits
        return { focusedIdx: next, lastExternalIdx: null }; // user navigation
      });
    },
    [kits.length],
  );

  // Set focus to a specific index
  const setFocus = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= kits.length) return;
      setNav({ focusedIdx: idx, lastExternalIdx: null }); // user navigation
    },
    [kits.length],
  );

  // Reset focus if kits change, then follow externally controlled focus:
  // only update if changed
  const [syncedWith, setSyncedWith] = useState<{
    focusedKit: null | string;
    kits: KitWithRelations[];
  } | null>(null);
  if (syncedWith?.kits !== kits || syncedWith.focusedKit !== focusedKit) {
    setSyncedWith({ focusedKit, kits });
    let next =
      syncedWith?.kits === kits
        ? nav
        : { focusedIdx: 0, lastExternalIdx: null };
    if (focusedKit) {
      const idx = kits.findIndex(
        (k: KitWithRelations) => k.name === focusedKit,
      );
      if (idx !== -1 && next.lastExternalIdx !== idx) {
        next = { focusedIdx: idx, lastExternalIdx: idx };
      }
    }
    if (next !== nav) setNav(next);
  }

  return {
    focusedIdx: nav.focusedIdx,
    moveFocus,
    setFocus,
  };
}

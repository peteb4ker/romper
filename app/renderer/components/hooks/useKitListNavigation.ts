import { useCallback, useEffect, useRef, useState } from "react";

import type { KitWithRelations } from "../../../../shared/db/schema";

export function useKitListNavigation(
  kits: KitWithRelations[],
  focusedKit: string | null,
) {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const lastExternalIdx = useRef<number | null>(null);

  // Move focus by delta (row/col navigation)
  const moveFocus = useCallback(
    (delta: number) => {
      setFocusedIdx((idx) => {
        let next = idx + delta;
        if (next < 0) next = 0;
        if (next >= kits.length) next = kits.length - 1;
        lastExternalIdx.current = null; // user navigation
        return next;
      });
    },
    [kits.length],
  );

  // Set focus to a specific index
  const setFocus = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= kits.length) return;
      setFocusedIdx(idx);
      lastExternalIdx.current = null; // user navigation
    },
    [kits.length],
  );

  // Reset focus if kits change
  useEffect(() => {
    setFocusedIdx(0);
    lastExternalIdx.current = null;
  }, [kits]);

  // Externally controlled focus: only update if changed
  useEffect(() => {
    if (focusedKit) {
      const idx = kits.findIndex(
        (k: KitWithRelations) => k.name === focusedKit,
      );
      if (idx !== -1 && lastExternalIdx.current !== idx) {
        setFocusedIdx(idx);
        lastExternalIdx.current = idx;
      }
    }
  }, [focusedKit, kits]);

  return {
    focusedIdx,
    setFocus,
    moveFocus,
  };
}

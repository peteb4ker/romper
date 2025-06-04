import { useState, useCallback, useEffect } from 'react';

export function useKitListNavigation(kits) {
  const [focusedIdx, setFocusedIdx] = useState(0);

  // Move focus by delta (row/col navigation)
  const moveFocus = useCallback((delta) => {
    setFocusedIdx(idx => {
      let next = idx + delta;
      if (next < 0) next = 0;
      if (next >= kits.length) next = kits.length - 1;
      return next;
    });
  }, [kits.length]);

  // Set focus to a specific index
  const setFocus = useCallback((idx) => {
    if (idx < 0 || idx >= kits.length) return;
    setFocusedIdx(idx);
  }, [kits.length]);

  // Reset focus if kits change
  useEffect(() => {
    setFocusedIdx(0);
  }, [kits]);

  return {
    focusedIdx,
    setFocus,
    moveFocus,
  };
}

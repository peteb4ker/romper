import { useEffect, useRef } from "react";

interface UseSampleRefreshListenerParams {
  reloadCurrentKitSamples: (kitName: string) => Promise<void>;
  selectedKit: null | string;
}

/**
 * Listens for "romper:refresh-samples" events (dispatched by undo
 * operations) and reloads the affected kit's samples when it is the
 * currently selected kit. The listener is registered once; the latest
 * selection and reload function are read through refs.
 */
export function useSampleRefreshListener({
  reloadCurrentKitSamples,
  selectedKit,
}: UseSampleRefreshListenerParams) {
  // Store latest values in refs to avoid recreating event listener
  const selectedKitRef = useRef(selectedKit);
  const reloadCurrentKitSamplesRef = useRef(reloadCurrentKitSamples);

  // Update refs when values change
  useEffect(() => {
    selectedKitRef.current = selectedKit;
  }, [selectedKit]);

  useEffect(() => {
    reloadCurrentKitSamplesRef.current = reloadCurrentKitSamples;
  }, [reloadCurrentKitSamples]);

  // Listen for refresh events from undo operations - stable event listener
  useEffect(() => {
    const handleRefreshSamples = (event: Event) => {
      const customEvent = event as CustomEvent<{ kitName: string }>;
      if (customEvent.detail.kitName === selectedKitRef.current) {
        void reloadCurrentKitSamplesRef.current(selectedKitRef.current);
      }
    };

    document.addEventListener("romper:refresh-samples", handleRefreshSamples);

    return () => {
      document.removeEventListener(
        "romper:refresh-samples",
        handleRefreshSamples,
      );
    };
  }, []); // Empty dependency array - event listener is created only once
}

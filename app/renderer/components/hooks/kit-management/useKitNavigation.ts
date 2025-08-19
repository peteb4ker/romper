import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type { KitWithRelations } from "@romper/shared/db/schema";

import { compareKitSlots } from "@romper/shared/kitUtilsShared";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { markExplicitNavigation } from "../../../utils/hmrStateManager";

interface UseKitNavigationProps {
  allKitSamples: { [kit: string]: VoiceSamples };
  kits: KitWithRelations[];
  refreshAllKitsAndSamples: () => Promise<void>;
}

interface UseKitNavigationReturn {
  currentKitIndex: number;
  handleBack: (scrollToKit?: any) => Promise<void>;
  handleNextKit: () => void;
  handlePrevKit: () => void;
  handleSelectKit: (kitName: string) => void;
  selectedKit: null | string;
  selectedKitSamples: null | VoiceSamples;
  setSelectedKit: (kitName: string) => void;
  sortedKits: KitWithRelations[];
}

/**
 * Custom hook for managing kit navigation and selection
 * Handles kit selection, navigation between kits, and back navigation
 */
export function useKitNavigation({
  allKitSamples,
  kits,
  refreshAllKitsAndSamples,
}: UseKitNavigationProps): UseKitNavigationReturn {
  const [selectedKit, setSelectedKit] = useState<null | string>(null);
  const [selectedKitSamples, setSelectedKitSamples] =
    useState<null | VoiceSamples>(null);

  // Track active timeouts for cleanup
  const activeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Sort kits for consistent navigation order
  const sortedKits = React.useMemo(() => {
    return kits
      ? kits.slice().sort((a, b) => compareKitSlots(a.name, b.name))
      : [];
  }, [kits]);

  // Find current kit index for navigation
  const currentKitIndex = sortedKits.findIndex((k) => k.name === selectedKit);

  // When a kit is selected, set its samples
  React.useEffect(() => {
    if (!selectedKit) {
      setSelectedKitSamples(null);
      return;
    }
    setSelectedKitSamples(
      allKitSamples[selectedKit] ?? { 1: [], 2: [], 3: [], 4: [] }
    );
  }, [selectedKit, allKitSamples]);

  // Kit selection handler
  const handleSelectKit = useCallback((kitName: string) => {
    setSelectedKit(kitName);
  }, []);

  // Navigate to next kit
  const handleNextKit = useCallback(() => {
    if (sortedKits && currentKitIndex < sortedKits.length - 1) {
      setSelectedKit(sortedKits[currentKitIndex + 1].name);
    }
  }, [sortedKits, currentKitIndex]);

  // Navigate to previous kit
  const handlePrevKit = useCallback(() => {
    if (sortedKits && currentKitIndex > 0) {
      setSelectedKit(sortedKits[currentKitIndex - 1].name);
    }
  }, [sortedKits, currentKitIndex]);

  // Helper function to parse scroll parameters
  const parseScrollParameters = (scrollToKit?: any) => {
    let scrollToKitName = null;
    let refresh = false;

    if (
      typeof scrollToKit === "object" &&
      scrollToKit !== null &&
      "scrollToKit" in scrollToKit &&
      "refresh" in scrollToKit
    ) {
      scrollToKitName = scrollToKit.scrollToKit;
      refresh = !!scrollToKit.refresh;
    } else {
      scrollToKitName = scrollToKit;
    }

    return { refresh, scrollToKitName };
  };

  // Helper function to scroll to a specific kit
  const scrollToKitElement = (scrollToKitName: string) => {
    // Only attempt scrolling in browser environment
    if (typeof document === "undefined") return;

    const timeoutId = setTimeout(() => {
      // Remove from tracking set when timeout executes
      activeTimeoutsRef.current.delete(timeoutId);

      // Double-check that document is still available (test environment safety)
      if (typeof document === "undefined") return;

      const kitEl = document.querySelector(`[data-kit='${scrollToKitName}']`);
      const container = kitEl?.closest(".overflow-y-auto");

      if (kitEl && container) {
        const containerRect = container.getBoundingClientRect();
        const kitRect = kitEl.getBoundingClientRect();
        const offset =
          kitRect.top -
          containerRect.top +
          container.scrollTop -
          containerRect.height / 2 +
          kitRect.height / 2;
        container.scrollTo({ behavior: "smooth", top: offset });
      } else if (kitEl) {
        kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    // Track timeout for cleanup
    activeTimeoutsRef.current.add(timeoutId);
  };

  // Back navigation handler with refresh and scroll support
  const handleBack = useCallback(
    async (scrollToKit?: any) => {
      const { refresh, scrollToKitName } = parseScrollParameters(scrollToKit);

      // Mark this as an explicit navigation action to prevent HMR restoration
      markExplicitNavigation();

      if (refresh) {
        await refreshAllKitsAndSamples();
      }

      setSelectedKit(null);
      setSelectedKitSamples(null);

      if (scrollToKitName) {
        scrollToKitElement(scrollToKitName);
      }
    },
    [refreshAllKitsAndSamples]
  );

  // Cleanup effect to clear all active timeouts on unmount
  useEffect(() => {
    const activeTimeouts = activeTimeoutsRef.current;
    return () => {
      // Clear all active timeouts when component unmounts
      activeTimeouts.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      activeTimeouts.clear();
    };
  }, []);

  return {
    currentKitIndex,
    handleBack,
    handleNextKit,
    handlePrevKit,
    handleSelectKit,
    selectedKit,
    selectedKitSamples,
    setSelectedKit,
    sortedKits,
  };
}

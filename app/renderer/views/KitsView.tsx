import React, { useEffect, useMemo, useState } from "react";

import {
  compareKitSlots,
  groupSamplesByVoice,
} from "../../../shared/kitUtilsShared";
import { useKitLabel } from "../components/hooks/useKitLabel";
import KitBrowser from "../components/KitBrowser";
import KitDetails from "../components/KitDetails";
import type {
  RampleKitLabel,
  RampleLabels,
  VoiceSamples,
} from "../components/kitTypes";
import LocalStoreWizardUI from "../components/LocalStoreWizardUI";
import { useSettings } from "../utils/SettingsContext";

const KitsView = () => {
  const { localStorePath, localStoreStatus, refreshLocalStoreStatus } =
    useSettings();
  const [kits, setKits] = useState<string[]>([]);
  const [allKitSamples, setAllKitSamples] = useState<{
    [kit: string]: VoiceSamples;
  }>({});
  const [kitLabels, setKitLabels] = useState<{ [kit: string]: RampleKitLabel }>(
    {},
  );
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [selectedKitSamples, setSelectedKitSamples] =
    useState<VoiceSamples | null>(null);
  const [showWizard, setShowWizard] = useState<boolean>(false);

  // Check if local store needs to be set up
  const needsLocalStoreSetup = !localStoreStatus?.isValid || !localStorePath;

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup) {
      setShowWizard(true);
    }
  }, [needsLocalStoreSetup]);

  // Add type guards for possibly undefined Electron APIs
  const safeListFilesInRoot = window.electronAPI?.listFilesInRoot?.bind(
    window.electronAPI,
  );
  const safeReadRampleLabels = window.electronAPI?.readRampleLabels?.bind(
    window.electronAPI,
  );
  const safeScanSdCard = window.electronAPI?.scanSdCard?.bind(
    window.electronAPI,
  );

  // Load all kits, samples, and labels on local store change
  useEffect(() => {
    if (!localStorePath || needsLocalStoreSetup) return;
    (async () => {
      // 1. Scan all kits
      if (!safeScanSdCard) {
        console.warn("scanSdCard is not available");
        setKits([]);
        return;
      }
      let kitNames: string[] = [];
      try {
        const scanResult = safeScanSdCard(localStorePath);
        kitNames = await (scanResult || Promise.resolve([]));
        setKits(kitNames);
      } catch (error) {
        console.warn("Error scanning local store:", error);
        setKits([]);
      }
      // 2. Scan all samples for each kit
      const samples: { [kit: string]: VoiceSamples } = {};
      for (const kit of kitNames) {
        const kitPath = `${localStorePath}/${kit}`;
        if (!safeListFilesInRoot) {
          console.warn("listFilesInRoot is not available");
          samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
          continue;
        }
        try {
          const files = await safeListFilesInRoot(kitPath);
          const wavs = files.filter((f: string) => /\.wav$/i.test(f));
          samples[kit] = groupSamplesByVoice(wavs);
        } catch (error) {
          console.warn(`Error listing files for kit ${kit}:`, error);
          samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
        }
      }
      setAllKitSamples(samples);
      // 3. Load labels
      if (!safeReadRampleLabels) {
        console.warn("readRampleLabels is not available");
        setKitLabels({});
        return;
      }
      try {
        const loadedLabels: RampleLabels | null =
          await safeReadRampleLabels(localStorePath);
        setKitLabels(
          loadedLabels && loadedLabels.kits ? loadedLabels.kits : {},
        );
      } catch (error) {
        console.warn("Error reading rample labels:", error);
        setKitLabels({});
      }
    })();
  }, [
    localStorePath,
    needsLocalStoreSetup,
    safeScanSdCard,
    safeListFilesInRoot,
    safeReadRampleLabels,
  ]);

  // When a kit is selected, set its samples
  useEffect(() => {
    if (!selectedKit) {
      setSelectedKitSamples(null);
      return;
    }
    setSelectedKitSamples(
      allKitSamples[selectedKit] || { 1: [], 2: [], 3: [], 4: [] },
    );
  }, [selectedKit, allKitSamples]);

  // Use the centralized hook instead
  const { handleRescanAllVoiceNames } = useKitLabel({
    kitName: selectedKit || "",
    localStorePath: localStorePath || "",
    onBack: () => {}, // no-op to satisfy KitDetailsProps
  });

  // Memoize sample counts for all kits
  const sampleCounts = useMemo(() => {
    const counts: Record<string, [number, number, number, number]> = {};
    for (const kit of kits) {
      const voices = allKitSamples[kit] || { 1: [], 2: [], 3: [], 4: [] };
      counts[kit] = [1, 2, 3, 4].map((v) => voices[v]?.length || 0) as [
        number,
        number,
        number,
        number,
      ];
    }
    return counts;
  }, [kits, allKitSamples]);

  // Memoize deduped voice label sets for all kits
  const voiceLabelSets = useMemo(() => {
    const sets: Record<string, string[]> = {};
    for (const kit of kits) {
      const labelObj = kitLabels[kit];
      if (labelObj && labelObj.voiceNames) {
        // Accept both array and object forms
        const values = Array.isArray(labelObj.voiceNames)
          ? labelObj.voiceNames
          : Object.values(labelObj.voiceNames);
        sets[kit] = Array.from(
          new Set(
            values.filter(Boolean).map((v) => (typeof v === "string" ? v : "")),
          ),
        );
      } else {
        sets[kit] = [];
      }
    }
    return sets;
  }, [kits, kitLabels]);

  const sortedKits = kits ? kits.slice().sort(compareKitSlots) : [];
  const currentKitIndex = sortedKits.findIndex((k) => k === selectedKit);
  const handleSelectKit = (kitName: string) => {
    setSelectedKit(kitName);
  };
  const handleNextKit = () => {
    if (sortedKits && currentKitIndex < sortedKits.length - 1) {
      setSelectedKit(sortedKits[currentKitIndex + 1]);
    }
  };
  const handlePrevKit = () => {
    if (sortedKits && currentKitIndex > 0) {
      setSelectedKit(sortedKits[currentKitIndex - 1]);
    }
  };

  // Mark handleBack as async if using await
  const handleBack = async (scrollToKit?: string) => {
    let scrollToKitName = null;
    let refresh = false;
    if (
      typeof scrollToKit === "object" &&
      scrollToKit !== null &&
      "scrollToKit" in scrollToKit &&
      "refresh" in scrollToKit
    ) {
      // @ts-expect-error: dynamic object
      scrollToKitName = scrollToKit.scrollToKit;
      // @ts-expect-error: dynamic object
      refresh = !!scrollToKit.refresh;
    } else {
      scrollToKitName = scrollToKit;
    }
    if (refresh) {
      // Re-scan all kits and samples
      if (localStorePath) {
        const kitNames = await window.electronAPI
          .scanSdCard(localStorePath)
          .catch(() => []);
        setKits(kitNames);
        const samples: { [kit: string]: VoiceSamples } = {};
        for (const kit of kitNames) {
          const kitPath = `${localStorePath}/${kit}`;
          if (!safeListFilesInRoot)
            throw new Error("listFilesInRoot is not available");
          const files = await safeListFilesInRoot(kitPath).catch(() => []);
          const wavs = files.filter((f: string) => /\.wav$/i.test(f));
          samples[kit] = groupSamplesByVoice(wavs);
        }
        setAllKitSamples(samples);
      }
    }
    setSelectedKit(null);
    setSelectedKitSamples(null);
    if (scrollToKitName) {
      setTimeout(() => {
        // Prefer scrolling the KitBrowser's scroll container, not the window
        const kitEl = document.querySelector(`[data-kit='${scrollToKitName}']`);
        // Find the KitBrowser scroll container by class or ref
        const container = kitEl && kitEl.closest(".overflow-y-auto");
        if (kitEl && container) {
          // Scroll the container so the kit is centered
          const containerRect = container.getBoundingClientRect();
          const kitRect = kitEl.getBoundingClientRect();
          const offset =
            kitRect.top -
            containerRect.top +
            container.scrollTop -
            containerRect.height / 2 +
            kitRect.height / 2;
          container.scrollTo({ top: offset, behavior: "smooth" });
        } else if (kitEl) {
          // Fallback: scroll the kit element into view
          kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {selectedKit && selectedKitSamples ? (
        <KitDetails
          kitName={selectedKit || ""}
          localStorePath={localStorePath || ""}
          onBack={handleBack}
          onRescanAllVoiceNames={() =>
            handleRescanAllVoiceNames(selectedKitSamples)
          }
          samples={selectedKitSamples}
          kitLabel={kitLabels[selectedKit] || null}
          onRequestSamplesReload={async () => {
            // Re-scan samples for this kit only
            const kitPath = `${localStorePath}/${selectedKit}`;
            if (!safeListFilesInRoot)
              throw new Error("listFilesInRoot is not available");
            const files: string[] = await safeListFilesInRoot(kitPath).catch(
              () => [],
            );
            const wavFiles = files.filter((f) => /\.wav$/i.test(f));
            const voices = groupSamplesByVoice(wavFiles);
            setAllKitSamples((prev) => ({ ...prev, [selectedKit]: voices }));
            setSelectedKitSamples(voices);
          }}
          onNextKit={handleNextKit}
          onPrevKit={handlePrevKit}
          kits={sortedKits}
          kitIndex={currentKitIndex}
          onMessage={(msg) => {
            // Optionally handle messages here, e.g. show a toast or log
            // For now, do nothing (parent can decide to handle or ignore)
          }}
        />
      ) : (
        <KitBrowser
          localStorePath={localStorePath}
          kits={sortedKits}
          onSelectKit={handleSelectKit}
          kitLabels={kitLabels}
          onRescanAllVoiceNames={() => handleRescanAllVoiceNames(undefined)}
          sampleCounts={sampleCounts}
          voiceLabelSets={voiceLabelSets}
          onMessage={(msg) => {
            // Optionally handle messages here, e.g. show a toast or log
            // For now, do nothing (parent can decide to handle or ignore)
          }}
        />
      )}

      {/* Show local store wizard if needed */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Local Store Setup Required
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                The local store must be set up before the app can be used.
                Please complete the setup wizard to continue.
              </p>
            </div>
            <LocalStoreWizardUI
              onClose={() => {
                // Close the app if user cancels the auto-triggered wizard
                window.electronAPI?.closeApp?.();
              }}
              onSuccess={async () => {
                setShowWizard(false);
                // Refresh local store status after successful setup
                await refreshLocalStoreStatus();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KitsView;

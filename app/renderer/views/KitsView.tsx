import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  compareKitSlots,
  groupSamplesByVoice,
} from "../../../shared/kitUtilsShared";
import ChangeLocalStoreDirectoryDialog from "../components/ChangeLocalStoreDirectoryDialog";
import { useBankScanning } from "../components/hooks/useBankScanning";
import { useMenuEvents } from "../components/hooks/useMenuEvents";
import { useMessageDisplay } from "../components/hooks/useMessageDisplay";
import { useStartupActions } from "../components/hooks/useStartupActions";
import { useValidationResults } from "../components/hooks/useValidationResults";
import KitBrowser, { KitBrowserHandle } from "../components/KitBrowser";
import KitDetails from "../components/KitDetails";
import type { VoiceSamples } from "../components/kitTypes";
import LocalStoreWizardUI from "../components/LocalStoreWizardUI";
import { useSettings } from "../utils/SettingsContext";

// Convert database sample objects to VoiceSamples format
function groupDbSamplesByVoice(dbSamples: any[]): VoiceSamples {
  const voices: VoiceSamples = { 1: [], 2: [], 3: [], 4: [] };

  dbSamples.forEach((sample: any) => {
    const voiceNumber = sample.voice_number;
    if (voiceNumber >= 1 && voiceNumber <= 4) {
      voices[voiceNumber].push(sample.filename);
    }
  });

  // Sort samples within each voice
  Object.keys(voices).forEach((v) => voices[+v].sort());
  return voices;
}

const KitsView = () => {
  const {
    localStorePath,
    localStoreStatus,
    refreshLocalStoreStatus,
    setLocalStorePath,
    isInitialized,
  } = useSettings();
  const { showMessage } = useMessageDisplay();
  const [kits, setKits] = useState<string[]>([]);
  const [kitData, setKitData] = useState<any[]>([]);
  const [allKitSamples, setAllKitSamples] = useState<{
    [kit: string]: VoiceSamples;
  }>({});
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [selectedKitSamples, setSelectedKitSamples] =
    useState<VoiceSamples | null>(null);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [showChangeDirectoryDialog, setShowChangeDirectoryDialog] =
    useState<boolean>(false);

  // Ref to access KitBrowser scan functionality
  const kitBrowserRef = useRef<KitBrowserHandle | null>(null);

  // Check if local store needs to be set up (wait for initialization AND status to be loaded)
  const needsLocalStoreSetup =
    isInitialized &&
    localStoreStatus !== null &&
    (!localStoreStatus?.isValid || !localStorePath);

  // Validation results hook for database validation
  const { openValidationDialog } = useValidationResults({
    localStorePath: localStorePath || "",
    onMessage: (msg) => {
      // You can integrate with a toast system here if needed
      console.log("[KitsView] Validation message:", msg);
    },
  });

  // Bank scanning hook
  const { scanBanks } = useBankScanning({
    localStorePath,
    onMessage: showMessage,
  });

  // Startup actions hook
  useStartupActions({
    localStorePath,
    needsLocalStoreSetup,
  });

  // Menu event handlers
  useMenuEvents({
    onScanAllKits: () => {
      console.log("[KitsView] Menu scan all kits triggered");
      if (kitBrowserRef.current?.handleScanAllKits) {
        kitBrowserRef.current.handleScanAllKits();
      }
    },
    onScanBanks: () => {
      console.log("[KitsView] Menu scan banks triggered");
      scanBanks();
    },
    onValidateDatabase: () => {
      console.log("[KitsView] Menu validate database triggered");
      openValidationDialog();
    },
    onSetupLocalStore: () => {
      console.log("[KitsView] Menu setup local store triggered");
      setShowWizard(true);
    },
    onChangeLocalStoreDirectory: () => {
      console.log("[KitsView] Menu change local store directory triggered");
      setShowChangeDirectoryDialog(true);
    },
    onAbout: () => {
      console.log("[KitsView] Menu about triggered");
      // Could show an about dialog here
    },
  });

  console.log("[KitsView] Local store status check:");
  console.log("[KitsView] localStorePath:", localStorePath);
  console.log("[KitsView] localStoreStatus:", localStoreStatus);
  console.log("[KitsView] needsLocalStoreSetup:", needsLocalStoreSetup);

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup) {
      setShowWizard(true);
    }
  }, [needsLocalStoreSetup]);

  // Database-only approach - no filesystem scanning needed

  // Load all kits, samples, and labels on local store change
  useEffect(() => {
    if (!isInitialized || !localStorePath || needsLocalStoreSetup) return;
    console.log("[KitsView] Loading kits from", localStorePath); // Log when effect runs
    (async () => {
      // 1. Load kits from database (includes bank relationships)
      let kitNames: string[] = [];
      try {
        const kitsResult = await window.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          const kitsWithBanks = kitsResult.data;
          setKitData(kitsWithBanks);
          // Extract kit names for compatibility with existing code
          kitNames = kitsWithBanks.map((kit: any) => kit.name);
          setKits(kitNames);
        } else {
          console.warn("Failed to load kits from database:", kitsResult?.error);
          setKits([]);
          setKitData([]);
        }
      } catch (error) {
        console.warn("Error loading kits from database:", error);
        setKits([]);
        setKitData([]);
      }
      // 2. Load samples for each kit from database
      const samples: { [kit: string]: VoiceSamples } = {};
      for (const kit of kitNames) {
        try {
          const samplesResult =
            await window.electronAPI?.getAllSamplesForKit?.(kit);
          if (samplesResult?.success && samplesResult.data) {
            samples[kit] = groupDbSamplesByVoice(samplesResult.data);
          } else {
            console.warn(
              `Failed to load samples for kit ${kit}:`,
              samplesResult?.error,
            );
            samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
          }
        } catch (error) {
          console.warn(`Error loading samples for kit ${kit}:`, error);
          samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
        }
      }
      setAllKitSamples(samples);
    })();
  }, [isInitialized, localStorePath, needsLocalStoreSetup]);

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

  // TODO: Legacy voice rescanning method - can be removed since kit scanning now handles this

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
      // Re-load all kits and samples from database
      try {
        // Load kits from database
        const kitsResult = await window.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          const kitsWithBanks = kitsResult.data;
          setKitData(kitsWithBanks);
          const kitNames = kitsWithBanks.map((kit: any) => kit.name);
          setKits(kitNames);

          // Load samples from database for each kit
          const samples: { [kit: string]: VoiceSamples } = {};
          for (const kit of kitNames) {
            try {
              const samplesResult =
                await window.electronAPI?.getAllSamplesForKit?.(kit);
              if (samplesResult?.success && samplesResult.data) {
                samples[kit] = groupDbSamplesByVoice(samplesResult.data);
              } else {
                samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
              }
            } catch (error) {
              console.warn(`Error loading samples for kit ${kit}:`, error);
              samples[kit] = { 1: [], 2: [], 3: [], 4: [] };
            }
          }
          setAllKitSamples(samples);
        } else {
          console.warn("Failed to load kits from database:", kitsResult?.error);
          setKits([]);
          setKitData([]);
          setAllKitSamples({});
        }
      } catch (error) {
        console.warn("Error loading data from database:", error);
        setKits([]);
        setKitData([]);
        setAllKitSamples({});
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
          samples={selectedKitSamples}
          onRequestSamplesReload={async () => {
            // Re-load samples for this kit from database
            if (selectedKit) {
              try {
                const samplesResult =
                  await window.electronAPI?.getAllSamplesForKit?.(selectedKit);
                if (samplesResult?.success && samplesResult.data) {
                  const voices = groupDbSamplesByVoice(samplesResult.data);
                  setAllKitSamples((prev) => ({
                    ...prev,
                    [selectedKit]: voices,
                  }));
                  setSelectedKitSamples(voices);
                } else {
                  console.warn(
                    `Failed to reload samples for kit ${selectedKit}:`,
                    samplesResult?.error,
                  );
                }
              } catch (error) {
                console.warn(
                  `Error reloading samples for kit ${selectedKit}:`,
                  error,
                );
              }
            }
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
          ref={kitBrowserRef}
          localStorePath={localStorePath}
          kits={sortedKits}
          kitData={kitData}
          onSelectKit={handleSelectKit}
          sampleCounts={sampleCounts}
          onRescanAllVoiceNames={() => {}} // TODO: Implement or remove if no longer needed
          onMessage={(msg) => {
            // Optionally handle messages here, e.g. show a toast or log
            // For now, do nothing (parent can decide to handle or ignore)
          }}
          setLocalStorePath={setLocalStorePath}
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
                console.log("[KitsView] Wizard success callback called");
                setShowWizard(false);
                console.log("[KitsView] Calling refreshLocalStoreStatus");
                // Refresh local store status after successful setup
                await refreshLocalStoreStatus();
                console.log("[KitsView] refreshLocalStoreStatus completed");
              }}
              setLocalStorePath={setLocalStorePath}
            />
          </div>
        </div>
      )}

      {/* Change Local Store Directory Dialog */}
      <ChangeLocalStoreDirectoryDialog
        isOpen={showChangeDirectoryDialog}
        onClose={() => setShowChangeDirectoryDialog(false)}
        onMessage={(msg) => {
          showMessage(msg.text, msg.type, msg.duration);
        }}
      />
    </div>
  );
};

export default KitsView;

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { KitWithRelations } from "../../../shared/db/schema";
import { compareKitSlots } from "../../../shared/kitUtilsShared";
import ChangeLocalStoreDirectoryDialog from "../components/dialogs/ChangeLocalStoreDirectoryDialog";
import PreferencesDialog from "../components/dialogs/PreferencesDialog";
import { useBankScanning } from "../components/hooks/useBankScanning";
import { useGlobalKeyboardShortcuts } from "../components/hooks/useGlobalKeyboardShortcuts";
import { useKit } from "../components/hooks/useKit";
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

  // First, sort samples by voice_number and slot_number to ensure proper ordering
  const sortedSamples = [...dbSamples].sort((a, b) => {
    if (a.voice_number !== b.voice_number) {
      return a.voice_number - b.voice_number;
    }
    return a.slot_number - b.slot_number;
  });

  // Group samples by voice, maintaining slot order
  sortedSamples.forEach((sample: any) => {
    const voiceNumber = sample.voice_number;
    if (voiceNumber >= 1 && voiceNumber <= 4) {
      // Create array with proper slot positions (12 slots per voice)
      if (!Array.isArray(voices[voiceNumber])) {
        voices[voiceNumber] = [];
      }
      // Use slot_number - 1 as index (slot_number is 1-based, array is 0-based)
      const slotIndex = sample.slot_number - 1;
      if (slotIndex >= 0 && slotIndex < 12) {
        voices[voiceNumber][slotIndex] = sample.filename;

        // Task 7: If this is a stereo sample, also show it in the next voice
        // This indicates that the next voice slot is consumed by the stereo pair
        if (sample.is_stereo && voiceNumber < 4) {
          const nextVoice = voiceNumber + 1;
          if (!Array.isArray(voices[nextVoice])) {
            voices[nextVoice] = [];
          }
          // Show the same filename in the next voice to indicate it's consumed
          voices[nextVoice][slotIndex] = sample.filename;
        }
      }
    }
  });

  // Fill empty slots with empty strings for consistent array length
  Object.keys(voices).forEach((v) => {
    const voice = voices[+v];
    for (let i = 0; i < 12; i++) {
      if (!voice[i]) {
        voice[i] = "";
      }
    }
    // Remove trailing empty slots to keep arrays compact
    while (voice.length > 0 && voice[voice.length - 1] === "") {
      voice.pop();
    }
  });

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
  const [kits, setKits] = useState<KitWithRelations[]>([]);
  const [allKitSamples, setAllKitSamples] = useState<{
    [kit: string]: VoiceSamples;
  }>({});
  const [selectedKit, setSelectedKit] = useState<string | null>(null);
  const [selectedKitSamples, setSelectedKitSamples] =
    useState<VoiceSamples | null>(null);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [showChangeDirectoryDialog, setShowChangeDirectoryDialog] =
    useState<boolean>(false);
  const [showPreferencesDialog, setShowPreferencesDialog] =
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
    localStorePath: localStorePath ?? "",
    onMessage: (msg) => {
      // You can integrate with a toast system here if needed
      console.log("[KitsView] Validation message:", msg);
    },
  });

  // Bank scanning hook
  const { scanBanks } = useBankScanning({
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
    onPreferences: () => {
      console.log("[KitsView] Menu preferences triggered");
      setShowPreferencesDialog(true);
    },
    onAbout: () => {
      console.log("[KitsView] Menu about triggered");
      // Could show an about dialog here
    },
    onUndo: () => {
      console.log("[KitsView] Menu undo triggered");
      if (keyboardShortcuts.canUndo) {
        // Create and dispatch keyboard event to trigger undo
        const event = new KeyboardEvent("keydown", {
          key: "z",
          metaKey: true, // For Mac
          ctrlKey: true, // For Windows/Linux
          bubbles: true,
        });
        document.dispatchEvent(event);
      }
    },
    onRedo: () => {
      console.log("[KitsView] Menu redo triggered");
      if (keyboardShortcuts.canRedo) {
        // Create and dispatch keyboard event to trigger redo
        const event = new KeyboardEvent("keydown", {
          key: "z",
          metaKey: true, // For Mac
          ctrlKey: true, // For Windows/Linux
          shiftKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }
    },
  });

  // Get current kit's editable state for keyboard shortcuts
  // Note: Use useKit hook to get fresh kit data instead of stale kits array
  const { kit: currentKit } = useKit({ kitName: selectedKit ?? "" });

  // Global keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
  const keyboardShortcuts = useGlobalKeyboardShortcuts({
    currentKitName: selectedKit ?? undefined,
    isEditMode: currentKit?.editable ?? false,
  });

  // Local store status logging (remove in production)
  // console.log("[KitsView] localStorePath:", localStorePath);
  // console.log("[KitsView] localStoreStatus:", JSON.stringify(localStoreStatus, null, 2));
  // console.log("[KitsView] needsLocalStoreSetup:", needsLocalStoreSetup);

  // Auto-trigger wizard on startup if local store is not configured
  useEffect(() => {
    if (needsLocalStoreSetup) {
      setShowWizard(true);
    }
  }, [needsLocalStoreSetup]);

  // Database-only approach - no filesystem scanning needed

  // Reusable function to load all kits and their data
  const loadKitsData = useCallback(
    async (scrollToKit?: string) => {
      if (!isInitialized || !localStorePath || needsLocalStoreSetup) return;
      console.log("[KitsView] Loading kits from", localStorePath);

      // 1. Load kits from database (includes bank relationships)
      let kitNames: string[] = [];
      let loadedKits: KitWithRelations[] = [];
      try {
        const kitsResult = await window.electronAPI?.getKits?.();
        if (kitsResult?.success && kitsResult.data) {
          const kitsWithBanks =
            kitsResult.data as unknown as KitWithRelations[];
          setKits(kitsWithBanks);
          loadedKits = kitsWithBanks;
          kitNames = kitsWithBanks.map((kit: KitWithRelations) => kit.name);
        } else {
          console.warn("Failed to load kits from database:", kitsResult?.error);
          setKits([]);
          loadedKits = [];
        }
      } catch (error) {
        console.warn("Error loading kits from database:", error);
        setKits([]);
        loadedKits = [];
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

      // If a specific kit should be scrolled to, do it after data loads
      if (scrollToKit && kitBrowserRef.current) {
        setTimeout(() => {
          // Use the loaded kits data instead of the stale kits state
          const sortedKitNames = loadedKits
            .map((k) => k.name)
            .sort(compareKitSlots);
          const kitIndex = sortedKitNames.findIndex(
            (name) => name === scrollToKit,
          );

          if (kitIndex !== -1) {
            // Use the KitList scroll method via the KitBrowser ref
            // const kitBrowser = kitBrowserRef.current;
            // We need to access the KitList ref through the KitBrowser logic
            // For now, let's use a simpler DOM-based scroll approach
            const kitEl = document.querySelector(`[data-kit='${scrollToKit}']`);
            if (kitEl) {
              kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }, 100); // Small delay to ensure DOM is updated
      }
    },
    [isInitialized, localStorePath, needsLocalStoreSetup],
  );

  // Load all kits, samples, and labels on local store change
  useEffect(() => {
    loadKitsData();
  }, [loadKitsData]);

  // When a kit is selected, set its samples
  useEffect(() => {
    if (!selectedKit) {
      setSelectedKitSamples(null);
      return;
    }
    setSelectedKitSamples(
      allKitSamples[selectedKit] ?? { 1: [], 2: [], 3: [], 4: [] },
    );
  }, [selectedKit, allKitSamples]);

  // Memoize sample counts for all kits
  const sampleCounts = useMemo(() => {
    const counts: Record<string, [number, number, number, number]> = {};
    for (const kit of kits) {
      const kitName = kit.name;
      const voices = allKitSamples[kitName] ?? { 1: [], 2: [], 3: [], 4: [] };
      counts[kitName] = [1, 2, 3, 4].map((v) => voices[v]?.length ?? 0) as [
        number,
        number,
        number,
        number,
      ];
    }
    return counts;
  }, [kits, allKitSamples]);

  const sortedKits = kits
    ? kits.slice().sort((a, b) => compareKitSlots(a.name, b.name))
    : [];
  const currentKitIndex = sortedKits.findIndex((k) => k.name === selectedKit);
  const handleSelectKit = (kitName: string) => {
    setSelectedKit(kitName);
  };
  const handleNextKit = () => {
    if (sortedKits && currentKitIndex < sortedKits.length - 1) {
      setSelectedKit(sortedKits[currentKitIndex + 1].name);
    }
  };
  const handlePrevKit = () => {
    if (sortedKits && currentKitIndex > 0) {
      setSelectedKit(sortedKits[currentKitIndex - 1].name);
    }
  };

  // Mark handleBack as async if using await
  // Function to reload samples for the currently selected kit
  const reloadCurrentKitSamples = useCallback(async () => {
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
        console.warn(`Error reloading samples for kit ${selectedKit}:`, error);
      }
    }
  }, [selectedKit]);

  // Listen for refresh events from undo operations
  useEffect(() => {
    const handleRefreshSamples = (event: Event) => {
      const customEvent = event as CustomEvent<{ kitName: string }>;
      if (customEvent.detail.kitName === selectedKit) {
        console.log(
          "[KitsView] Refreshing samples after undo operation for kit:",
          selectedKit,
        );
        reloadCurrentKitSamples();
      }
    };

    document.addEventListener("romper:refresh-samples", handleRefreshSamples);

    return () => {
      document.removeEventListener(
        "romper:refresh-samples",
        handleRefreshSamples,
      );
    };
  }, [selectedKit, reloadCurrentKitSamples]);

  // Helper function to parse scroll parameters
  const parseScrollParameters = (scrollToKit?: string) => {
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

    return { scrollToKitName, refresh };
  };

  // Helper function to load all kits and samples from database
  const refreshAllKitsAndSamples = async () => {
    try {
      const kitsResult = await window.electronAPI?.getKits?.();
      if (kitsResult?.success && kitsResult.data) {
        const kitsWithBanks = kitsResult.data as unknown as KitWithRelations[];
        setKits(kitsWithBanks);
        const kitNames = kitsWithBanks.map((kit: KitWithRelations) => kit.name);

        const samples: { [kit: string]: VoiceSamples } = {};
        for (const kit of kitNames) {
          samples[kit] = await loadKitSamples(kit);
        }
        setAllKitSamples(samples);
      } else {
        console.warn("Failed to load kits from database:", kitsResult?.error);
        setKits([]);
        setAllKitSamples({});
      }
    } catch (error) {
      console.warn("Error loading data from database:", error);
      setKits([]);
      setAllKitSamples({});
    }
  };

  // Helper function to load samples for a single kit
  const loadKitSamples = async (kit: string): Promise<VoiceSamples> => {
    try {
      const samplesResult =
        await window.electronAPI?.getAllSamplesForKit?.(kit);
      if (samplesResult?.success && samplesResult.data) {
        return groupDbSamplesByVoice(samplesResult.data);
      }
    } catch (error) {
      console.warn(`Error loading samples for kit ${kit}:`, error);
    }
    return { 1: [], 2: [], 3: [], 4: [] };
  };

  // Helper function to scroll to a specific kit
  const scrollToKitElement = (scrollToKitName: string) => {
    setTimeout(() => {
      const kitEl = document.querySelector(`[data-kit='${scrollToKitName}']`);
      const container = kitEl && kitEl.closest(".overflow-y-auto");

      if (kitEl && container) {
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
        kitEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const handleBack = async (scrollToKit?: string) => {
    const { scrollToKitName, refresh } = parseScrollParameters(scrollToKit);

    if (refresh) {
      await refreshAllKitsAndSamples();
    }

    setSelectedKit(null);
    setSelectedKitSamples(null);

    if (scrollToKitName) {
      scrollToKitElement(scrollToKitName);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {selectedKit && selectedKitSamples ? (
        <KitDetails
          kitName={selectedKit ?? ""}
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
          onMessage={() => {
            // Optionally handle messages here, e.g. show a toast or log
            // For now, do nothing (parent can decide to handle or ignore)
          }}
          onAddUndoAction={keyboardShortcuts.addUndoAction}
        />
      ) : (
        <KitBrowser
          ref={kitBrowserRef}
          localStorePath={localStorePath}
          kits={sortedKits}
          onSelectKit={handleSelectKit}
          sampleCounts={sampleCounts}
          onRefreshKits={loadKitsData}
          onMessage={() => {
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

      {/* Preferences Dialog */}
      <PreferencesDialog
        isOpen={showPreferencesDialog}
        onClose={() => setShowPreferencesDialog(false)}
      />
    </div>
  );
};

export default KitsView;

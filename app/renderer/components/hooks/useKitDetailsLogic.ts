import React from "react";
import { toast } from "sonner";

import { inferVoiceTypeFromFilename } from "../../../../shared/kitUtilsShared";
import type { KitDetailsProps, RampleKitLabel } from "../kitTypes";
import { executeFullKitScan } from "../utils/scanners/orchestrationFunctions";
import { useKitDetails } from "./useKitDetails";
import { useKitMetadata } from "./useKitMetadata";
import { useKitPlayback } from "./useKitPlayback";
import { useKitVoicePanels } from "./useKitVoicePanels";

interface UseKitDetailsLogicParams extends KitDetailsProps {
  kitLabel?: RampleKitLabel;
  onRescanAllVoiceNames?: () => void;
  onCreateKit?: () => void;
  onMessage?: (msg: { type: string; text: string }) => void;
}

/**
 * Main business logic hook for KitDetails component
 * Orchestrates all kit detail operations including playback, metadata, scanning, and navigation
 */
export function useKitDetailsLogic(props: UseKitDetailsLogicParams) {
  // Playback logic
  const playback = useKitPlayback(props.samples);

  // Metadata management
  const metadata = useKitMetadata(props);

  // Default samples to avoid undefined errors
  const samples = React.useMemo(
    () => props.samples || { 1: [], 2: [], 3: [], 4: [] },
    [props.samples],
  );

  // Auto-scan logic: triggers auto-rescan if all voice names are missing and samples are loaded
  useKitDetails({
    kitLabel: metadata.kitLabel || undefined,
    samples,
    localStorePath: props.localStorePath,
    kitName: props.kitName,
    onRescanAllVoiceNames: () => metadata.handleRescanAllVoiceNames(samples),
  });

  // Handler for comprehensive kit scanning
  const handleScanKit = React.useCallback(async () => {
    if (!props.localStorePath || !props.kitName) {
      toast.error("Kit path and name are required for scanning");
      return;
    }

    const toastId = toast.loading("Starting comprehensive kit scan...", {
      duration: Infinity,
    });

    try {
      // Prepare scan input data
      const kitPath = `${props.localStorePath}/${props.kitName}`;

      // Get all WAV files from samples
      const wavFiles: string[] = [];
      Object.values(samples).forEach((voiceSamples: string[]) => {
        voiceSamples.forEach((sample: string) => {
          if (sample.endsWith(".wav")) {
            wavFiles.push(`${kitPath}/${sample}`);
          }
        });
      });

      // Get RTF files (artist metadata files)
      const rtfFiles: string[] = [];
      // Check for bank-level RTF files (A.rtf, B.rtf, etc.)
      const bankName = props.kitName.charAt(0);
      if (bankName >= "A" && bankName <= "Z") {
        rtfFiles.push(`${props.localStorePath}/${bankName}.rtf`);
      }

      // File reader function for scans
      const fileReader = window.electronAPI?.readFile
        ? async (filePath: string): Promise<ArrayBuffer> => {
            if (!window.electronAPI?.readFile) {
              throw new Error("Electron API not available");
            }
            const result = await window.electronAPI.readFile(filePath);
            if (!result?.success || !result.data) {
              throw new Error(result?.error || "Failed to read file");
            }
            return result.data;
          }
        : undefined;

      // Setup progress callback
      let lastProgress = 0;
      const progressCallback = (
        current: number,
        total: number,
        operation: string,
      ) => {
        const progress = Math.round((current / total) * 100);
        if (progress > lastProgress) {
          lastProgress = progress;
          toast.loading(`${operation} (${progress}%)`, {
            id: toastId,
            duration: Infinity,
          });
        }
      };

      // Execute full kit scan with all operations
      const scanInput = { samples, wavFiles, rtfFiles, fileReader };
      const result = await executeFullKitScan(scanInput, progressCallback);

      if (result.success) {
        toast.success(
          `Kit scan completed successfully! ${result.completedOperations}/${result.totalOperations} operations completed.`,
          { id: toastId, duration: 5000 },
        );

        // Reload kit metadata to reflect changes
        if (metadata.handleFullKitScan) {
          await metadata.handleFullKitScan(samples);
        }
      } else {
        const errorMessage =
          result.errors.length > 0
            ? `Scan completed with errors: ${result.errors.map((e) => e.error).join(", ")}`
            : "Scan failed with unknown error";

        toast.error(errorMessage, { id: toastId, duration: 8000 });
      }
    } catch (error) {
      toast.error(
        `Kit scan error: ${error instanceof Error ? error.message : String(error)}`,
        { id: toastId, duration: 8000 },
      );
    }
  }, [
    samples,
    props.localStorePath,
    props.kitName,
    metadata,
    // metadata.handleFullKitScan is included in metadata already
  ]);

  // Navigation state
  const [selectedVoice, setSelectedVoice] = React.useState(1);
  const [selectedSampleIdx, setSelectedSampleIdx] = React.useState(0);
  const [sequencerOpen, setSequencerOpen] = React.useState(false);

  // Ref for sequencer grid
  const sequencerGridRef = React.useRef<HTMLDivElement | null>(null);

  // Use KitVoicePanels hook for navigation logic
  const kitVoicePanels = useKitVoicePanels({
    samples,
    kitLabel: metadata.kitLabel,
    selectedVoice,
    selectedSampleIdx,
    setSelectedVoice,
    setSelectedSampleIdx,
    onSaveVoiceName: metadata.handleSaveVoiceName,
    onRescanVoiceName: metadata.handleRescanVoiceName,
    samplePlaying: playback.samplePlaying,
    playTriggers: playback.playTriggers,
    stopTriggers: playback.stopTriggers,
    onPlay: playback.handlePlay,
    onStop: playback.handleStop,
    onWaveformPlayingChange: playback.handleWaveformPlayingChange,
    localStorePath: props.localStorePath,
    kitName: props.kitName,
    onSampleSelect: (voice: number, idx: number) => {
      setSelectedVoice(voice);
      setSelectedSampleIdx(idx);
    },
  });

  // Error reporting effects
  // Destructure the onMessage prop to avoid re-renders when other props change
  const { onMessage } = props;

  React.useEffect(() => {
    if (playback.playbackError && onMessage) {
      onMessage({ type: "error", text: playback.playbackError });
    }
  }, [playback.playbackError, onMessage]);

  React.useEffect(() => {
    if (metadata.labelsError && onMessage) {
      onMessage({ type: "error", text: metadata.labelsError });
    }
  }, [metadata.labelsError, onMessage]);

  // Listen for SampleWaveform errors bubbled up from children
  React.useEffect(() => {
    if (!onMessage) return;
    const handler = (e: CustomEvent) => {
      onMessage({ type: "error", text: e.detail });
    };
    window.addEventListener("SampleWaveformError", handler as EventListener);
    return () => {
      window.removeEventListener(
        "SampleWaveformError",
        handler as EventListener,
      );
    };
  }, [onMessage]);

  // Focus management
  React.useEffect(() => {
    if (sequencerOpen) {
      // Focus the sequencer grid
      setTimeout(() => {
        sequencerGridRef.current?.focus();
      }, 0);
    }
  }, [sequencerOpen]);

  // Global keyboard navigation for sample preview and sequencer toggle
  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Ignore if a modal, input, textarea, or contenteditable is focused
      const active = document.activeElement;
      if (
        active &&
        ((active.tagName === "INPUT" &&
          (active as HTMLInputElement).type !== "checkbox") ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      // S key toggles sequencer
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSequencerOpen((open) => !open);
        return;
      }
      // Only handle navigation keys for sample nav if sequencer is closed
      if (
        !sequencerOpen &&
        ["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)
      ) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          kitVoicePanels.onSampleKeyNav("down");
        } else if (e.key === "ArrowUp") {
          kitVoicePanels.onSampleKeyNav("up");
        } else if (e.key === " " || e.key === "Enter") {
          // Preview/play selected sample
          const samplesForVoice = samples[selectedVoice] || [];
          const sample = samplesForVoice[selectedSampleIdx];
          if (sample) {
            playback.handlePlay(selectedVoice, sample);
          }
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    sequencerOpen,
    selectedVoice,
    selectedSampleIdx,
    samples,
    playback,
    playback.handlePlay,
    kitVoicePanels,
  ]);

  return {
    // State
    samples,
    selectedVoice,
    selectedSampleIdx,
    sequencerOpen,
    sequencerGridRef,

    // State setters
    setSelectedVoice,
    setSelectedSampleIdx,
    setSequencerOpen,

    // Handlers
    handleScanKit,

    // Sub-hooks
    playback,
    metadata,
    kitVoicePanels,
  };
}

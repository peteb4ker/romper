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
  onRequestSamplesReload?: () => Promise<void>;
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

  // Handler for kit rescanning (database-first approach)
  const { kitName, onRequestSamplesReload } = props;
  const handleScanKit = React.useCallback(async () => {
    if (!kitName) {
      toast.error("Kit name is required for scanning");
      return;
    }

    const toastId = toast.loading("Rescanning kit from local store...", {
      duration: Infinity,
    });

    try {
      // Use the rescanKit IPC method which:
      // 1. Clears existing samples from database
      // 2. Scans the kit folder for current WAV files
      // 3. Updates database with found samples
      if (!window.electronAPI?.rescanKit) {
        throw new Error("Rescan API not available");
      }

      const result = await window.electronAPI.rescanKit(kitName);

      if (result.success) {
        toast.success(
          `Kit rescanned successfully! Found ${result.data?.scannedSamples || 0} samples.`,
          { id: toastId, duration: 5000 },
        );

        // Trigger sample reload in parent component
        if (onRequestSamplesReload) {
          await onRequestSamplesReload();
        }

        // Rescan voice names based on updated samples
        if (metadata.handleRescanAllVoiceNames) {
          await metadata.handleRescanAllVoiceNames(samples);
        }
      } else {
        toast.error(`Kit rescan failed: ${result.error}`, {
          id: toastId,
          duration: 8000,
        });
      }
    } catch (error) {
      toast.error(
        `Kit scan error: ${error instanceof Error ? error.message : String(error)}`,
        { id: toastId, duration: 8000 },
      );
    }
  }, [kitName, onRequestSamplesReload, samples, metadata]);

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

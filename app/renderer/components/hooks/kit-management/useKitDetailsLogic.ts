import type { KitDetailsProps } from "@romper/app/renderer/components/kitTypes";

import React from "react";
import { toast } from "sonner";

import { ErrorPatterns } from "../../../utils/errorHandling";
import { useSampleManagement } from "../sample-management/useSampleManagement";
import { useBpm } from "../shared/useBpm";
import { useStepPattern } from "../shared/useStepPattern";
import { useVoiceAlias } from "../voice-panels/useVoiceAlias";
import { useKit } from "./useKit";
import { useKitPlayback } from "./useKitPlayback";
import { useKitVoicePanels } from "./useKitVoicePanels";

interface UseKitDetailsLogicParams extends KitDetailsProps {
  onCreateKit?: () => void;
  onKitUpdated?: () => Promise<void>;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRequestSamplesReload?: () => Promise<void>;
}

/**
 * Main business logic hook for KitDetails component
 * Orchestrates all kit detail operations including playback, metadata, scanning, and navigation
 */
export function useKitDetailsLogic(props: UseKitDetailsLogicParams) {
  // Destructure props for useEffect dependencies
  const { onNextKit, onPrevKit } = props;

  // Core kit data
  const {
    error: kitError,
    kit,
    loading: kitLoading,
    reloadKit,
    toggleEditableMode,
    updateKitAlias,
  } = useKit({
    kitName: props.kitName,
    onKitUpdated: props.onKitUpdated,
  });

  // Voice alias management
  const { updateVoiceAlias } = useVoiceAlias({
    kitName: props.kitName,
    onUpdate: () => {
      reloadKit().catch(console.error);
    },
  });

  // Sample management for drag-and-drop operations (Task 5.2.2 & 5.2.3)
  const sampleManagement = useSampleManagement({
    kitName: props.kitName,
    onAddUndoAction: props.onAddUndoAction,
    onMessage: props.onMessage,
    onSamplesChanged: async () => {
      // Reload both kit data and samples when samples change
      await reloadKit();
      if (props.onRequestSamplesReload) {
        await props.onRequestSamplesReload();
      }
    },
  });

  // Step pattern management
  const { setStepPattern, stepPattern } = useStepPattern({
    initialPattern: kit?.step_pattern,
    kitName: props.kitName,
  });

  // BPM management
  const { bpm, setBpm } = useBpm({
    initialBpm: kit?.bpm,
    kitName: props.kitName,
  });

  // Playback logic
  const playback = useKitPlayback(props.samples);

  // Default samples to avoid undefined errors
  const samples = React.useMemo(
    () => props.samples || { 1: [], 2: [], 3: [], 4: [] },
    [props.samples]
  );

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
          { duration: 5000, id: toastId }
        );

        // Trigger sample reload in parent component
        if (onRequestSamplesReload) {
          await onRequestSamplesReload();
        }

        // Reload kit to show updated voice names from rescan
        await reloadKit();

        // Note: Voice inference is now handled automatically by rescanKit
        // No need to call handleRescanAllVoiceNames separately
      } else {
        toast.error(`Kit rescan failed: ${result.error}`, {
          duration: 8000,
          id: toastId,
        });
      }
    } catch (error) {
      ErrorPatterns.kitOperation(error, "rescan");
      toast.error(
        `Kit scan error: ${error instanceof Error ? error.message : String(error)}`,
        { duration: 8000, id: toastId }
      );
    }
  }, [kitName, onRequestSamplesReload, reloadKit]);

  // Navigation state
  const [selectedVoice, setSelectedVoice] = React.useState(1);
  const [selectedSampleIdx, setSelectedSampleIdx] = React.useState(0);
  const [sequencerOpen, setSequencerOpen] = React.useState(false);

  // Ref for sequencer grid
  const sequencerGridRef = React.useRef<HTMLDivElement | null>(null);

  // Use KitVoicePanels hook for navigation logic
  const kitVoicePanels = useKitVoicePanels({
    kit,
    kitName: props.kitName,
    onPlay: playback.handlePlay,
    onRescanVoiceName: () => {
      // Legacy voice rescanning is no longer needed as kit scanning handles voice inference
    },
    onSampleSelect: (voice: number, idx: number) => {
      setSelectedVoice(voice);
      setSelectedSampleIdx(idx);
    },
    onSaveVoiceName: (voice: number, alias: null | string) => {
      updateVoiceAlias(voice, alias ?? "").catch(console.error);
    },
    onStop: playback.handleStop,
    onWaveformPlayingChange: playback.handleWaveformPlayingChange,
    playTriggers: playback.playTriggers,
    samplePlaying: playback.samplePlaying,
    samples,
    selectedSampleIdx,
    selectedVoice,
    setSelectedSampleIdx,
    setSelectedVoice,
    stopTriggers: playback.stopTriggers,
  });

  // Error reporting effects
  // Destructure the onMessage prop to avoid re-renders when other props change
  const { onMessage } = props;

  React.useEffect(() => {
    if (playback.playbackError && onMessage) {
      onMessage(playback.playbackError, "error");
    }
  }, [playback.playbackError, onMessage]);

  React.useEffect(() => {
    if (kitError && onMessage) {
      onMessage(kitError, "error");
    }
  }, [kitError, onMessage]);

  // Listen for SampleWaveform errors bubbled up from children
  React.useEffect(() => {
    if (!onMessage) return;
    const handler = (e: CustomEvent) => {
      onMessage(e.detail, "error");
    };
    window.addEventListener("SampleWaveformError", handler as EventListener);
    return () => {
      window.removeEventListener(
        "SampleWaveformError",
        handler as EventListener
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

  // Global keyboard navigation for sample preview, sequencer toggle, kit navigation, and scanning
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

      // Kit navigation shortcuts
      if (e.key === ",") {
        e.preventDefault();
        onPrevKit?.();
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        onNextKit?.();
        return;
      }
      // Kit scanning shortcut
      if (e.key === "/") {
        e.preventDefault();
        handleScanKit();
        return;
      }
      // S key toggles sequencer
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSequencerOpen((open) => !open);
        return;
      }
      // Only handle navigation keys for sample nav if sequencer is closed
      // Enter key removed to prevent conflicts with kit name editing
      if (!sequencerOpen && [" ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          kitVoicePanels.onSampleKeyNav("down");
        } else if (e.key === "ArrowUp") {
          kitVoicePanels.onSampleKeyNav("up");
        } else if (e.key === " ") {
          // Preview/play selected sample with Space key only
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
    onPrevKit,
    onNextKit,
    handleScanKit,
  ]);

  return {
    // BPM management
    bpm,
    // Handlers
    handleScanKit,
    // Kit data
    kit,
    kitError,
    kitLoading,

    kitVoicePanels,
    // Sub-hooks
    playback,
    reloadKit,

    // Sample management for drag-and-drop (Task 5.2.2 & 5.2.3)
    sampleManagement,

    // State
    samples,
    selectedSampleIdx,
    selectedVoice,
    sequencerGridRef,
    sequencerOpen,
    setBpm,
    setSelectedSampleIdx,
    // State setters
    setSelectedVoice,
    setSequencerOpen,

    setStepPattern,
    stepPattern,

    toggleEditableMode,
    updateKitAlias,

    updateVoiceAlias,
  };
}

import type { KitEditorProps } from "@romper/app/renderer/components/kitTypes";
import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import { useSampleManagement } from "../sample-management/useSampleManagement";
import { useBpm } from "../shared/useBpm";
import { useStepPattern } from "../shared/useStepPattern";
import { useTriggerConditions } from "../shared/useTriggerConditions";
import { useVoiceAlias } from "../voice-panels/useVoiceAlias";
import { useKitEditorKeyboardNav } from "./useKitEditorKeyboardNav";
import { useKitErrorReporting } from "./useKitErrorReporting";
import { useKitPlayback } from "./useKitPlayback";
import { useKitScanning } from "./useKitScanning";
import { useKitVoicePanels } from "./useKitVoicePanels";

export type { ScanStatus } from "./useKitScanning";

interface UseKitEditorLogicParams extends KitEditorProps {
  kit?: KitWithRelations; // Kit data passed from parent
  kitError?: null | string; // Error from parent kit loading
  onCreateKit?: () => void;
  onKitUpdated?: () => Promise<void>;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKitMetadata?: () => Promise<void>;
  onRequestSamplesReload?: () => Promise<void>;
  onToggleEditableMode?: (kitName: string) => Promise<void>;
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<{ isFavorite?: boolean; success: boolean }>;
  onUpdateKitAlias?: (kitName: string, alias: string) => Promise<void>;
}

/**
 * Main business logic hook for KitEditor component.
 * Composes the focused concern hooks (playback, scanning, navigation,
 * error reporting, metadata) and owns only the glue state between them.
 */
export function useKitEditorLogic(props: UseKitEditorLogicParams) {
  // Destructure props for useEffect dependencies
  const {
    kitName,
    onKitUpdated,
    onMessage,
    onNextKit,
    onPrevKit,
    onRefreshKitMetadata,
    onRequestSamplesReload,
    onToggleEditableMode,
    onUpdateKitAlias,
  } = props;

  // Use kit data from props instead of loading it
  const kit = props.kit ?? null; // Convert undefined to null for compatibility
  const kitError = props.kitError ?? null; // Accept error from parent if provided
  const kitLoading = false; // Data is passed from parent

  // Reload kit function - now just triggers parent refresh
  const reloadKit = React.useCallback(async () => {
    if (onKitUpdated) {
      await onKitUpdated();
    }
  }, [onKitUpdated]);

  // Toggle editable mode via parent callback
  const toggleEditableMode = React.useCallback(async () => {
    if (onToggleEditableMode && kitName) {
      await onToggleEditableMode(kitName);
    }
  }, [onToggleEditableMode, kitName]);

  // Update kit alias via parent callback
  const updateKitAlias = React.useCallback(
    async (alias: string) => {
      if (onUpdateKitAlias && kitName) {
        await onUpdateKitAlias(kitName, alias);
      }
    },
    [onUpdateKitAlias, kitName],
  );

  // Voice alias management
  const { updateVoiceAlias } = useVoiceAlias({
    kitName,
    onUpdate: () => {
      reloadKit().catch(console.error);
    },
  });

  // Sample management for drag-and-drop operations (Task 5.2.2 & 5.2.3)
  const sampleManagement = useSampleManagement({
    kitName,
    onAddUndoAction: props.onAddUndoAction,
    onMessage: props.onMessage,
    onSamplesChanged: async () => {
      // Reload both kit data and samples when samples change
      await reloadKit();
      if (onRequestSamplesReload) {
        await onRequestSamplesReload();
      }
    },
  });

  // Step pattern management
  const { setStepPattern, stepPattern } = useStepPattern({
    initialPattern: kit?.step_pattern,
    kitName,
    onSaved: reloadKit,
  });

  // Trigger conditions management
  const { setTriggerConditions, triggerConditions } = useTriggerConditions({
    initialConditions: kit?.trigger_conditions,
    kitName,
    onSaved: reloadKit,
  });

  // BPM management
  const { bpm, setBpm } = useBpm({
    initialBpm: kit?.bpm,
    kitName,
  });

  // Playback logic
  const playback = useKitPlayback(props.samples);

  // Default samples to avoid undefined errors
  const samples = React.useMemo(
    () => props.samples || { 1: [], 2: [], 3: [], 4: [] },
    [props.samples],
  );

  // Scanning logic (filesystem rescan + in-memory voice name inference)
  const { flashVoices, handleInferVoiceNames, handleScanKit, scanStatus } =
    useKitScanning({
      kitName,
      onRefreshKitMetadata,
      onRequestSamplesReload,
      reloadKit,
      samples,
    });

  // Navigation state
  const [selectedVoice, setSelectedVoice] = React.useState(1);
  const [selectedSampleIdx, setSelectedSampleIdx] = React.useState(0);
  const [sequencerOpen, setSequencerOpen] = React.useState(false);

  // Ref for sequencer grid
  const sequencerGridRef = React.useRef<HTMLDivElement | null>(null);

  // Use KitVoicePanels hook for navigation logic
  const kitVoicePanels = useKitVoicePanels({
    kit,
    kitName,
    onPlay: playback.handlePlay,
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

  // Forward playback / kit / waveform errors to the parent message handler
  useKitErrorReporting({
    kitError,
    onMessage,
    playbackError: playback.playbackError,
  });

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
  useKitEditorKeyboardNav({
    isEditable: !!kit?.editable,
    onInferVoiceNames: handleInferVoiceNames,
    onNextKit,
    onPlaySample: playback.handlePlay,
    onPrevKit,
    onSampleKeyNav: kitVoicePanels.onSampleKeyNav,
    onScanKit: handleScanKit,
    samples,
    selectedSampleIdx,
    selectedVoice,
    sequencerOpen,
    setSequencerOpen,
  });

  return {
    // BPM management
    bpm,
    // Flash feedback for voice name updates
    flashVoices,
    // Handlers
    handleInferVoiceNames,
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
    // Scan status (inline progress feedback)
    scanStatus,
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
    setTriggerConditions,
    stepPattern,
    toggleEditableMode,
    triggerConditions,
    updateKitAlias,

    updateVoiceAlias,
  };
}

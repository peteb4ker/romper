import type { KitEditorProps } from "@romper/app/renderer/components/kitTypes";
import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import { createLogger } from "../../../utils/logger";
import { useSampleManagement } from "../sample-management/useSampleManagement";
import { useStepPattern } from "../shared/useStepPattern";
import { useTriggerConditions } from "../shared/useTriggerConditions";
import { useVoiceAlias } from "../voice-panels/useVoiceAlias";
import { useKitEditorKeyboardNav } from "./useKitEditorKeyboardNav";
import { useKitErrorReporting } from "./useKitErrorReporting";
import { useKitPlayback } from "./useKitPlayback";
import { useKitScanning } from "./useKitScanning";
import { useKitVoicePanels } from "./useKitVoicePanels";

export type { ScanStatus } from "./useKitScanning";

const log = createLogger("KitEditor");

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
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
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
    onToggleFavorite,
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

  // Toggle editable mode via parent callback. Called from a click, so a
  // failure is reported here rather than rejected into it (RE-41)
  const isEditable = Boolean(kit?.editable);
  const toggleEditableMode = React.useCallback(async () => {
    if (!onToggleEditableMode || !kitName) return;
    try {
      await onToggleEditableMode(kitName);
    } catch (error) {
      log.warn("Toggling editable mode failed:", error);
      onMessage?.(
        `Couldn't turn editing ${isEditable ? "off" : "on"} for kit ${kitName}. Try again.`,
        "error",
      );
    }
  }, [onToggleEditableMode, kitName, isEditable, onMessage]);

  // Add the open kit to favorites or remove it, from the header's star
  // button or the ; key. Neither can show a failure, so it's reported here
  // (#554).
  const isFavorite = Boolean(kit?.is_favorite);
  const toggleFavorite = React.useMemo(() => {
    if (!onToggleFavorite || !kitName) return undefined;
    const failed = () =>
      onMessage?.(
        isFavorite
          ? `Couldn't remove kit ${kitName} from favorites. Try again.`
          : `Couldn't add kit ${kitName} to favorites. Try again.`,
        "error",
      );
    return async () => {
      try {
        const result = await onToggleFavorite(kitName);
        if (result?.success === false) failed();
      } catch (error) {
        log.warn("Toggling the favorite failed:", error);
        failed();
      }
    };
  }, [onToggleFavorite, kitName, isFavorite, onMessage]);

  // Update kit alias via parent callback. Called on blur and Enter, so a
  // failure is reported here rather than rejected into them (RE-41)
  const updateKitAlias = React.useCallback(
    async (alias: string) => {
      if (!onUpdateKitAlias || !kitName) return;
      try {
        await onUpdateKitAlias(kitName, alias);
      } catch (error) {
        log.warn("Saving the kit name failed:", error);
        onMessage?.(
          `Couldn't save the name for kit ${kitName}. Try again.`,
          "error",
        );
      }
    },
    [onUpdateKitAlias, kitName, onMessage],
  );

  // Voice alias management
  const { updateVoiceAlias } = useVoiceAlias({
    kitName,
    onMessage,
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
    onMessage,
    onSaved: reloadKit,
  });

  // Trigger conditions management
  const { setTriggerConditions, triggerConditions } = useTriggerConditions({
    initialConditions: kit?.trigger_conditions,
    kitName,
    onMessage,
    onSaved: reloadKit,
  });

  // Playback logic
  const playback = useKitPlayback();

  // Default samples to avoid undefined errors
  const samples = React.useMemo(
    () => props.samples || { 1: [], 2: [], 3: [], 4: [] },
    [props.samples],
  );

  // The kit's voice names, so inference keeps the ones it has (RE-75)
  const voiceNames = React.useMemo(
    () =>
      Object.fromEntries(
        (kit?.voices ?? []).map((v) => [v.voice_number, v.voice_alias]),
      ),
    [kit?.voices],
  );

  // Scanning logic (filesystem rescan + in-memory voice name inference)
  const { flashVoices, handleInferVoiceNames, handleScanKit, scanStatus } =
    useKitScanning({
      kitName,
      onRefreshKitMetadata,
      onRequestSamplesReload,
      reloadKit,
      samples,
      voiceNames,
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
    onSaveVoiceName: (voice: number, alias: null | string) =>
      updateVoiceAlias(voice, alias ?? ""),
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
    onInferVoiceNames: () => void handleInferVoiceNames(),
    onNextKit,
    onPlaySample: playback.handlePlay,
    onPrevKit,
    onSampleKeyNav: kitVoicePanels.onSampleKeyNav,
    onScanKit: () => void handleScanKit(),
    onToggleFavorite: toggleFavorite,
    samples,
    selectedSampleIdx,
    selectedVoice,
    sequencerOpen,
    setSequencerOpen,
  });

  return {
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
    setSelectedSampleIdx,
    // State setters
    setSelectedVoice,
    setSequencerOpen,

    setStepPattern,
    setTriggerConditions,
    stepPattern,
    toggleEditableMode,
    toggleFavorite,
    triggerConditions,
    updateKitAlias,

    updateVoiceAlias,
  };
}

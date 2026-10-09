import type { Sample } from "@romper/shared/db/schema";

import React from "react";

import type { SlotPlaybackStore } from "./hooks/kit-management/slotPlaybackStore";
import type {
  SlotGainChange,
  SlotGainCommit,
} from "./hooks/voice-panels/types";
import type { SampleData } from "./kitTypes";

import { useSampleActions } from "./hooks/sample-management/useSampleActions";
import { useSlotRendering } from "./hooks/sample-management/useSlotRendering";
import { useDragAndDrop } from "./hooks/shared/useDragAndDrop";
import { type StereoDropHandlers } from "./hooks/shared/useExternalDragHandlers";
import { useKeyboardNavigation } from "./hooks/shared/useKeyboardNavigation";
import { useVoiceNameEditor } from "./hooks/voice-panels/useVoiceNameEditor";
import { useVoicePanelRendering } from "./hooks/voice-panels/useVoicePanelRendering";

interface KitVoicePanelProps {
  /** The kit's sample details couldn't be read, or not yet: gains are unknown (#628) */
  gainsUnknown?: boolean;
  /** The kit's sample details couldn't be read, so previews don't play (#636) */
  gainsUnreadable?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  isEditable?: boolean;
  isFlashing?: boolean;
  isLinkedPrimary?: boolean;
  kitName: string;
  /** The kit's sample rows as loaded, for a drop's duplicate check (#452) */
  kitSamples?: Sample[];
  /** The pair was linked by Romper, not by hand (#537): labelled */
  linkedAutomatically?: boolean;
  linkedWith?: number;
  onGainChange?: SlotGainChange;
  onGainCommit?: SlotGainCommit;
  // Tells the user about files a drop didn't add (RE-40)
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onPlay: (voice: number, slot: number) => void;
  // New props for drag-and-drop sample assignment (Task 5.2.2)
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  onSampleDelete?: (voice: number, slotNumber: number) => Promise<void>;
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  onSampleSelect?: (voice: number, idx: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => Promise<boolean> | void;

  onStop: (voice: number, slot: number) => void;
  onVoiceUnlink?: (primaryVoice: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    slot: number,
    playing: boolean,
  ) => void;
  /** The voice is in a stereo pair, as the write makes it (#569) */
  playsStereo: boolean;
  sampleMetadata?: { [slotKey: string]: SampleData }; // Keyed by slotKey(voice, slot)
  samples: string[];

  // New props for cross-voice navigation
  selectedIdx?: number; // index of selected sample in this voice, or -1 if not active
  setSharedDraggedSample?: (
    sample: {
      sampleName: string;
      slot: number;
      voice: number;
    } | null,
  ) => void;
  // Shared drag state for cross-voice operations
  sharedDraggedSample?: {
    sampleName: string;
    slot: number;
    voice: number;
  } | null;

  /** Each slot's playback, read by the slot itself (#482) */
  slotPlayback: SlotPlaybackStore;

  /** Stereo questions and messages for a drop (#537) */
  stereoDrop?: StereoDropHandlers;
  /** A mono voice's note: its stereo samples are mixed down (#537) */
  stereoNote?: string;
  voice: number;
  voiceName: null | string;
}

const KitVoicePanel: React.FC<
  { dataTestIdVoiceName?: string } & KitVoicePanelProps
> = ({
  dataTestIdVoiceName,
  gainsUnknown = false,
  gainsUnreadable = false,
  isActive = false,
  isDisabled = false,
  isEditable = true,
  isFlashing = false,
  isLinkedPrimary = false,
  kitName,
  kitSamples,
  linkedAutomatically = false,
  linkedWith,
  onGainChange,
  onGainCommit,
  onMessage,
  onPlay,
  onSampleAdd,
  onSampleDelete,
  onSampleMove,
  onSampleSelect,
  onSaveVoiceName,
  onStop,
  onVoiceUnlink,
  onWaveformPlayingChange,
  playsStereo,
  sampleMetadata,
  samples,
  selectedIdx = -1,
  setSharedDraggedSample,
  sharedDraggedSample,
  slotPlayback,
  stereoDrop,
  stereoNote,
  voice,
  voiceName,
}) => {
  // Effective editable state considers disabled
  const effectiveEditable = isEditable && !isDisabled;

  // Voice name editing functionality
  const voiceNameEditor = useVoiceNameEditor({
    onSaveVoiceName,
    voice,
    voiceName,
  });

  // Sample actions (delete, context menu)
  const sampleActions = useSampleActions({
    isDisabled,
    isEditable: effectiveEditable,
    onSampleDelete,
    voice,
  });

  // Drag and drop functionality
  const dragAndDrop = useDragAndDrop({
    isDisabled,
    isEditable: effectiveEditable,
    kitName,
    kitSamples,
    onMessage,
    onSampleAdd,
    onSampleMove,
    samples,
    setSharedDraggedSample,
    sharedDraggedSample,
    stereoDrop,
    voice,
  });

  // Keyboard navigation
  const keyboardNav = useKeyboardNavigation({
    isActive,
    onPlay,
    samples,
    selectedIdx,
    voice,
  });

  // Slot rendering calculations
  const slotRendering = useSlotRendering({
    dragOverSlot: dragAndDrop.dragOverSlot,
    dropZone: dragAndDrop.dropZone,
    isActive,
    playsStereo,
    samples,
    selectedIdx,
    voice,
  });

  // Rendering functions hook
  const rendering = useVoicePanelRendering({
    dragAndDropHook: dragAndDrop,
    gainsUnknown,
    gainsUnreadable,
    isActive,
    isEditable: effectiveEditable,
    isLinkedPrimary,
    kitName,
    linkedAutomatically,
    linkedWith,
    onGainChange,
    onGainCommit,
    onPlay,
    onSampleSelect,
    onStop,
    onVoiceUnlink,
    onWaveformPlayingChange,
    playsStereo,
    sampleActionsHook: sampleActions,
    sampleMetadata,
    samples,
    selectedIdx,
    slotPlayback,
    slotRenderingHook: slotRendering,
    stereoNote,
    voice,
    voiceName,
    voiceNameEditorHook: voiceNameEditor,
  });

  // Keyboard navigation for sample slots
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    // Focus the selected item if list is focused and this panel is active
    if (
      isActive &&
      listRef.current &&
      listRef.current.contains(document.activeElement) &&
      selectedIdx >= 0
    ) {
      const item = listRef.current.querySelectorAll("li")[selectedIdx];
      if (item) (item as HTMLElement).focus();
    }
  }, [selectedIdx, isActive]);

  // Voice panel styles
  const voicePanelClasses = [
    "flex-1 p-3 rounded-lg shadow text-text-primary min-h-[80px] border border-border-subtle overflow-hidden",
    // Default background with grain texture
    "card-grain",
    // Flash animation after voice name inference
    isFlashing && "animate-voice-flash",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-label={`Voice ${voice} panel`} className="flex flex-col min-w-0">
      {rendering.renderVoiceName(dataTestIdVoiceName)}
      {/* Voice panel content */}
      <div className={voicePanelClasses}>
        {/* A grid, not a listbox: a sample row holds buttons and a gain
            knob, which a listbox option can't contain (#522) */}
        <ul
          aria-label={`Sample slots for voice ${voice}`}
          className="list-none ml-0 text-sm flex flex-col"
          data-testid={`sample-list-voice-${voice}`}
          onKeyDown={keyboardNav.handleKeyDown}
          ref={listRef}
          role="grid"
          tabIndex={isActive ? 0 : -1}
        >
          {rendering.renderSampleSlots()}
        </ul>
      </div>
    </div>
  );
};

export default KitVoicePanel;

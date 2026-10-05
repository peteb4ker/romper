import React from "react";

import type { PlayOptions, SampleData } from "./kitTypes";

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
  isActive?: boolean;
  isDisabled?: boolean;
  isEditable?: boolean;
  isFlashing?: boolean;
  isLinkedPrimary?: boolean;
  kitName: string;
  /** The pair was linked by Romper, not by hand (#537): labelled */
  linkedAutomatically?: boolean;
  linkedWith?: number;
  onBatchDropComplete?: () => void;
  onGainChange?: (
    voice: number,
    slotNumber: number,
    sampleName: string,
    gainDb: number,
  ) => void;
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
  // Dead prop: keyboard nav moved to the parent (see line 114). Retained
  // for API stability; removing would cascade through KitVoicePanels,
  // KitEditor, and several tests. NOSONAR suppresses S6767 here.
  onSampleKeyNav?: (direction: "down" | "up") => void; // NOSONAR
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  onSampleSelect?: (voice: number, idx: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => Promise<boolean> | void;

  onStop: (voice: number, slot: number) => void;
  onVoiceUnlink?: (primaryVoice: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    slot: number,
    playing: boolean,
  ) => void;
  playOptions?: { [key: string]: PlayOptions | undefined };
  /** The voice is in a stereo pair, as the write makes it (#569) */
  playsStereo: boolean;
  playTriggers: { [key: string]: number };
  playVolumes?: { [key: string]: number };
  sampleMetadata?: { [slotKey: string]: SampleData }; // Keyed by slotKey(voice, slot)
  samplePlaying: { [key: string]: boolean };

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

  /** Stereo questions and messages for a drop (#537) */
  stereoDrop?: StereoDropHandlers;
  /** A mono voice's note: its stereo samples are mixed down (#537) */
  stereoNote?: string;
  stopTriggers: { [key: string]: number };
  voice: number;
  voiceName: null | string;
}

const KitVoicePanel: React.FC<
  { dataTestIdVoiceName?: string } & KitVoicePanelProps
> = ({
  dataTestIdVoiceName,
  gainsUnknown = false,
  isActive = false,
  isDisabled = false,
  isEditable = true,
  isFlashing = false,
  isLinkedPrimary = false,
  kitName,
  linkedAutomatically = false,
  linkedWith,
  onBatchDropComplete,
  onGainChange,
  onMessage,
  onPlay,
  onSampleAdd,
  onSampleDelete,
  onSampleMove,
  onSampleReplace,
  // onSampleKeyNav, // Note: Keyboard navigation now handled by parent component
  onSampleSelect,
  onSaveVoiceName,
  onStop,
  onVoiceUnlink,
  onWaveformPlayingChange,
  playOptions,
  playsStereo,
  playTriggers,
  playVolumes,
  sampleMetadata,
  samplePlaying,
  samples,
  selectedIdx = -1,
  setSharedDraggedSample,
  sharedDraggedSample,
  stereoDrop,
  stereoNote,
  stopTriggers,
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
    onBatchDropComplete,
    onMessage,
    onSampleAdd,
    onSampleMove,
    onSampleReplace,
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
    samples,
    selectedIdx,
    voice,
  });

  // Rendering functions hook
  const rendering = useVoicePanelRendering({
    dragAndDropHook: dragAndDrop,
    gainsUnknown,
    isActive,
    isEditable: effectiveEditable,
    isLinkedPrimary,
    kitName,
    linkedAutomatically,
    linkedWith,
    onGainChange,
    onPlay,
    onSampleSelect,
    onStop,
    onVoiceUnlink,
    onWaveformPlayingChange,
    playOptions,
    playsStereo,
    playTriggers,
    playVolumes,
    sampleActionsHook: sampleActions,
    sampleMetadata,
    samplePlaying,
    samples,
    selectedIdx,
    slotRenderingHook: slotRendering,
    stereoNote,
    stopTriggers,
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
        <ul
          aria-label={`Sample slots for voice ${voice}`}
          className="list-none ml-0 text-sm flex flex-col"
          data-testid={`sample-list-voice-${voice}`}
          onKeyDown={keyboardNav.handleKeyDown}
          ref={listRef}
          role="listbox"
          tabIndex={isActive ? 0 : -1}
        >
          {rendering.renderSampleSlots()}
        </ul>
      </div>
    </div>
  );
};

export default KitVoicePanel;

import React from "react";

import type { SampleData } from "./kitTypes";

import { useSampleActions } from "./hooks/sample-management/useSampleActions";
import { useSlotRendering } from "./hooks/sample-management/useSlotRendering";
import { useDragAndDrop } from "./hooks/shared/useDragAndDrop";
import { useKeyboardNavigation } from "./hooks/shared/useKeyboardNavigation";
import { useVoiceNameEditor } from "./hooks/voice-panels/useVoiceNameEditor";
import { useVoicePanelRendering } from "./hooks/voice-panels/useVoicePanelRendering";

interface KitVoicePanelProps {
  isActive?: boolean;
  isDisabled?: boolean;
  isEditable?: boolean;
  isLinkedPrimary?: boolean;
  // Task 7.1.3: Props for coordinated stereo drop highlighting
  isStereoDragTarget?: boolean;
  kitName: string;
  linkedWith?: number;
  onBatchDropComplete?: () => void;
  onPlay: (voice: number, sample: string) => void;
  onRescanVoiceName: (voice: number) => void;
  // New props for drag-and-drop sample assignment (Task 5.2.2)
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotNumber: number) => Promise<void>;
  onSampleKeyNav?: (direction: "down" | "up") => void;
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
  ) => Promise<void>;
  onSampleSelect?: (voice: number, idx: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => void;
  onStereoDragLeave?: () => void;
  onStereoDragOver?: (
    voice: number,
    slotNumber: number,
    isStereo: boolean,
  ) => void;

  onStop: (voice: number, sample: string) => void;
  onVoiceUnlink?: (primaryVoice: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playTriggers: { [key: string]: number };
  playVolumes?: { [key: string]: number };
  sampleMetadata?: { [filename: string]: SampleData }; // Optional metadata lookup
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

  stereoDragSlotNumber?: number;
  stopTriggers: { [key: string]: number };
  voice: number;
  voiceName: null | string;
}

const KitVoicePanel: React.FC<
  { dataTestIdVoiceName?: string } & KitVoicePanelProps
> = ({
  dataTestIdVoiceName,
  isActive = false,
  isDisabled = false,
  isEditable = true,
  isLinkedPrimary = false,
  isStereoDragTarget = false,
  kitName,
  linkedWith,
  onBatchDropComplete,
  onPlay,
  onSampleAdd,
  onSampleDelete,
  onSampleMove,
  onSampleReplace,
  // onSampleKeyNav, // Note: Keyboard navigation now handled by parent component
  onSampleSelect,
  onSaveVoiceName,
  onStereoDragLeave,
  onStereoDragOver,
  onStop,
  onVoiceUnlink,
  onWaveformPlayingChange,
  playTriggers,
  playVolumes,
  sampleMetadata,
  // onRescanVoiceName, // Legacy - voice rescanning now handled by kit-level scanning
  samplePlaying,
  samples,
  selectedIdx = -1,
  setSharedDraggedSample,
  sharedDraggedSample,
  stereoDragSlotNumber,
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
    onSampleAdd,
    onSampleMove,
    onSampleReplace,
    onStereoDragLeave,
    onStereoDragOver,
    samples,
    setSharedDraggedSample,
    sharedDraggedSample,
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
    isStereoDragTarget,
    samples,
    selectedIdx,
    stereoDragSlotNumber,
    voice,
  });

  // Rendering functions hook
  const rendering = useVoicePanelRendering({
    dragAndDropHook: dragAndDrop,
    isActive,
    isEditable: effectiveEditable,
    isLinkedPrimary,
    kitName,
    linkedWith,
    onPlay,
    onSampleSelect,
    onStop,
    onVoiceUnlink,
    onWaveformPlayingChange,
    playTriggers,
    playVolumes,
    sampleActionsHook: sampleActions,
    sampleMetadata,
    samplePlaying,
    samples,
    selectedIdx,
    slotRenderingHook: slotRendering,
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
    "flex-1 p-3 rounded-lg shadow text-text-primary min-h-[80px] border border-border-subtle min-w-0 overflow-hidden",
    // Default background with grain texture
    "card-grain",
    // Stereo drag target
    isStereoDragTarget && "bg-accent-warning/15",
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
          className="list-none ml-0 text-sm flex flex-col min-w-0"
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

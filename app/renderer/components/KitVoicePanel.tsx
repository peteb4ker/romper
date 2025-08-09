import React from "react";

import type { SampleData } from "./kitTypes";

import { useSettings } from "../utils/SettingsContext";
import { useSampleActions } from "./hooks/sample-management/useSampleActions";
import { useSlotRendering } from "./hooks/sample-management/useSlotRendering";
import { useDragAndDrop } from "./hooks/shared/useDragAndDrop";
import { useKeyboardNavigation } from "./hooks/shared/useKeyboardNavigation";
import { useVoiceNameEditor } from "./hooks/voice-panels/useVoiceNameEditor";
import { useVoicePanelRendering } from "./hooks/voice-panels/useVoicePanelRendering";

interface KitVoicePanelProps {
  isActive?: boolean;
  isEditable?: boolean;
  // Task 7.1.3: Props for coordinated stereo drop highlighting
  isStereoDragTarget?: boolean;
  kitName: string;
  onPlay: (voice: number, sample: string) => void;
  onRescanVoiceName: (voice: number) => void;
  // New props for drag-and-drop sample assignment (Task 5.2.2)
  onSampleAdd?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotIndex: number) => Promise<void>;
  onSampleKeyNav?: (direction: "down" | "up") => void;
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleSelect?: (voice: number, idx: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => void;

  onStereoDragLeave?: () => void;
  onStereoDragOver?: (
    voice: number,
    slotIndex: number,
    isStereo: boolean,
  ) => void;
  onStop: (voice: number, sample: string) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playTriggers: { [key: string]: number };

  sampleMetadata?: { [filename: string]: SampleData }; // Optional metadata lookup
  samplePlaying: { [key: string]: boolean };
  samples: string[];

  // New props for cross-voice navigation
  selectedIdx?: number; // index of selected sample in this voice, or -1 if not active

  stereoDragSlotIndex?: number;
  stopTriggers: { [key: string]: number };
  voice: number;
  voiceName: null | string;
}

const KitVoicePanel: React.FC<
  { dataTestIdVoiceName?: string } & KitVoicePanelProps
> = ({
  dataTestIdVoiceName,
  isActive = false,
  isEditable = true,
  isStereoDragTarget = false,
  kitName,
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
  onWaveformPlayingChange,
  playTriggers,
  sampleMetadata,
  // onRescanVoiceName, // Legacy - voice rescanning now handled by kit-level scanning
  samplePlaying,
  samples,
  selectedIdx = -1,
  stereoDragSlotIndex,
  stopTriggers,
  voice,
  voiceName,
}) => {
  // Task 7.1.2: Get defaultToMonoSamples setting
  const { defaultToMonoSamples } = useSettings();

  // Voice name editing functionality
  const voiceNameEditor = useVoiceNameEditor({
    onSaveVoiceName,
    voice,
    voiceName,
  });

  // Sample actions (delete, context menu)
  const sampleActions = useSampleActions({
    isEditable,
    onSampleDelete,
    voice,
  });

  // Drag and drop functionality
  const dragAndDrop = useDragAndDrop({
    isEditable,
    kitName,
    onSampleAdd,
    onSampleMove,
    onSampleReplace,
    onStereoDragLeave,
    onStereoDragOver,
    samples,
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
    defaultToMonoSamples,
    dragOverSlot: dragAndDrop.dragOverSlot,
    dropZone: dragAndDrop.dropZone,
    isActive,
    isStereoDragTarget,
    samples,
    selectedIdx,
    stereoDragSlotIndex,
    voice,
  });

  // Rendering functions hook
  const rendering = useVoicePanelRendering({
    dragAndDropHook: dragAndDrop,
    isActive,
    isEditable,
    kitName,
    onPlay,
    onSampleSelect,
    onStop,
    onWaveformPlayingChange,
    playTriggers,
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

  return (
    <div aria-label={`Voice ${voice} panel`} className="flex flex-col">
      {rendering.renderVoiceName(dataTestIdVoiceName)}
      <div className="flex flex-1">
        {/* Slot numbers column */}
        <div className="flex flex-col justify-start pt-3 pr-2">
          {rendering.renderSlotNumbers()}
        </div>

        {/* Voice panel content */}
        <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
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
    </div>
  );
};

export default KitVoicePanel;

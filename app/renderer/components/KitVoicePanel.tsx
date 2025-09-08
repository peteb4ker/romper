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
  // Voice linking props for stereo handling
  isLinked?: boolean;
  isPrimaryVoice?: boolean;
  // Task 7.1.3: Props for coordinated stereo drop highlighting
  isStereoDragTarget?: boolean;
  kitName: string;
  linkedWith?: number;
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
  onVoiceLink?: (primaryVoice: number) => void;
  onVoiceUnlink?: (primaryVoice: number) => void;
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
  isEditable = true,
  isLinked = false,
  isPrimaryVoice = false,
  isStereoDragTarget = false,
  kitName,
  linkedWith,
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
  onVoiceLink,
  onVoiceUnlink,
  onWaveformPlayingChange,
  playTriggers,
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
    defaultToMonoSamples,
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

  // Voice linking styles
  const voicePanelClasses = [
    "flex-1 p-3 rounded-lg shadow text-gray-900 dark:text-gray-100 min-h-[80px]",
    // Default background
    "bg-gray-100 dark:bg-slate-800",
    // Linked voice styling
    isLinked &&
      isPrimaryVoice &&
      "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600",
    isLinked &&
      !isPrimaryVoice &&
      "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600",
    // Stereo drag target
    isStereoDragTarget && "bg-yellow-100 dark:bg-yellow-900/30",
  ]
    .filter(Boolean)
    .join(" ");

  const renderVoiceLinkingControls = () => {
    if (!isEditable) return null;

    return (
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Voice linking status indicator */}
          {isLinked && (
            <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              {isPrimaryVoice ? (
                <>
                  <span>🔗</span>
                  <span>Stereo (L→{linkedWith})</span>
                </>
              ) : (
                <>
                  <span>🔗</span>
                  <span>Linked ({linkedWith}→R)</span>
                </>
              )}
            </div>
          )}

          {/* Voice linking controls for voices 1-3 */}
          {voice <= 3 && !isLinked && (
            <button
              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              onClick={() => onVoiceLink?.(voice)}
              title={`Link voice ${voice} to voice ${voice + 1} for stereo`}
              type="button"
            >
              Link Stereo
            </button>
          )}

          {/* Voice unlinking control */}
          {isLinked && isPrimaryVoice && (
            <button
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              onClick={() => onVoiceUnlink?.(voice)}
              title={`Unlink voice ${voice} from stereo mode`}
              type="button"
            >
              Unlink
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div aria-label={`Voice ${voice} panel`} className="flex flex-col">
      {rendering.renderVoiceName(dataTestIdVoiceName)}
      {/* Voice panel content */}
      <div className={voicePanelClasses}>
        {renderVoiceLinkingControls()}
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

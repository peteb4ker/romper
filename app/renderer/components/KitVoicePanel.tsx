import React, { useState } from "react";
import {
  FiCheck,
  FiEdit2,
  FiPlay,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { toast } from "sonner";

import { toCapitalCase } from "../../../shared/kitUtilsShared";
import { useSettings } from "../utils/SettingsContext";
import { useStereoHandling } from "./hooks/useStereoHandling";
import type { SampleData } from "./kitTypes";
import SampleWaveform from "./SampleWaveform";

interface KitVoicePanelProps {
  voice: number;
  samples: string[];
  sampleMetadata?: { [filename: string]: SampleData }; // Optional metadata lookup
  voiceName: string | null;
  onSaveVoiceName: (voice: number, newName: string) => void;
  onRescanVoiceName: (voice: number) => void;
  samplePlaying: { [key: string]: boolean };
  playTriggers: { [key: string]: number };
  stopTriggers: { [key: string]: number };
  onPlay: (voice: number, sample: string) => void;
  onStop: (voice: number, sample: string) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  kitName: string;

  // New props for cross-voice navigation
  selectedIdx?: number; // index of selected sample in this voice, or -1 if not active
  onSampleKeyNav?: (direction: "up" | "down") => void;
  onSampleSelect?: (voice: number, idx: number) => void;
  isActive?: boolean;
  isEditable?: boolean;

  // New props for drag-and-drop sample assignment (Task 5.2.2)
  onSampleAdd?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotIndex: number) => Promise<void>;

  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => Promise<void>;

  // Task 7.1.3: Props for coordinated stereo drop highlighting
  isStereoDragTarget?: boolean;
  stereoDragSlotIndex?: number;
  onStereoDragOver?: (
    voice: number,
    slotIndex: number,
    isStereo: boolean,
  ) => void;
  onStereoDragLeave?: () => void;
}

const KitVoicePanel: React.FC<
  KitVoicePanelProps & { dataTestIdVoiceName?: string }
> = ({
  voice,
  samples,
  sampleMetadata,
  voiceName,
  onSaveVoiceName,
  // onRescanVoiceName, // TODO: Implement voice name rescanning
  samplePlaying,
  playTriggers,
  stopTriggers,
  onPlay,
  onStop,
  onWaveformPlayingChange,
  kitName,
  dataTestIdVoiceName,
  selectedIdx = -1,
  // onSampleKeyNav, // TODO: Implement keyboard navigation
  onSampleSelect,
  isActive = false,
  isEditable = true,
  onSampleAdd,
  onSampleReplace,
  onSampleDelete,
  onSampleMove,
  isStereoDragTarget = false,
  stereoDragSlotIndex,
  onStereoDragOver,
  onStereoDragLeave,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(voiceName || "");
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Task 22.2: Internal sample drag state
  const [, setDraggedSample] = useState<{
    voice: number;
    slot: number;
    sampleName: string;
  } | null>(null);
  const [dropZone, setDropZone] = useState<{
    slot: number;
    mode: "insert" | "overwrite";
  } | null>(null);

  // Task 7.1.2: Get defaultToMonoSamples setting and stereo handling logic
  const { defaultToMonoSamples } = useSettings();
  const {
    analyzeStereoAssignment,
    handleStereoConflict,
    applyStereoAssignment,
  } = useStereoHandling();

  // Helper functions to reduce cognitive complexity
  const getFilePathFromDrop = async (file: File): Promise<string> => {
    if (window.electronFileAPI?.getDroppedFilePath) {
      return await window.electronFileAPI.getDroppedFilePath(file);
    }
    return (file as any).path || file.name;
  };

  const validateDroppedFile = async (filePath: string) => {
    if (!window.electronAPI?.validateSampleFormat) {
      console.error("Format validation not available");
      return null;
    }

    const result = await window.electronAPI.validateSampleFormat(filePath);
    if (!result.success || !result.data) {
      console.error("Format validation failed:", result.error);
      return null;
    }

    const validation = result.data;
    if (!validation.isValid) {
      const handled = await handleValidationIssues(validation);
      if (!handled) return null;
    }

    return validation;
  };

  const handleValidationIssues = async (validation: any): Promise<boolean> => {
    const criticalIssues = validation.issues.filter((issue: any) =>
      ["extension", "fileAccess", "invalidFormat"].includes(issue.type),
    );

    if (criticalIssues.length > 0) {
      const errorMessage = criticalIssues.map((i: any) => i.message).join(", ");
      console.error(
        "Cannot assign sample due to critical format issues:",
        errorMessage,
      );

      toast.error("Cannot assign sample", {
        description: errorMessage,
        duration: 5000,
      });
      return false;
    }

    const warningMessage = validation.issues
      .map((i: any) => i.message)
      .join(", ");
    console.warn(
      "Sample has format issues that will require conversion during SD card sync:",
      warningMessage,
    );

    toast.warning("Sample format warning", {
      description: `${warningMessage} The sample will be converted during SD card sync.`,
      duration: 7000,
    });
    return true;
  };

  const getCurrentKitSamples = async () => {
    if (!window.electronAPI?.getAllSamplesForKit) {
      console.error("Sample management not available");
      return null;
    }

    const result = await window.electronAPI.getAllSamplesForKit(kitName);
    if (!result.success) {
      console.error("Failed to get samples:", result.error);
      return null;
    }

    return result.data || [];
  };

  const isDuplicateSample = async (
    allSamples: any[],
    filePath: string,
  ): Promise<boolean> => {
    const voiceSamples = allSamples.filter(
      (s: any) => s.voice_number === voice,
    );
    const isDuplicate = voiceSamples.some(
      (s: any) => s.source_path === filePath,
    );

    if (isDuplicate) {
      toast.warning("Duplicate sample", {
        description: `Sample already exists in voice ${voice}`,
        duration: 5000,
      });
    }

    return isDuplicate;
  };

  const processAssignment = async (
    filePath: string,
    formatValidation: any,
    allSamples: any[],
    modifierKeys: { forceStereoDrop: boolean; forceMonoDrop: boolean },
    droppedSlotIndex: number,
  ): Promise<boolean> => {
    const channels = formatValidation.metadata?.channels || 1;

    if (modifierKeys.forceMonoDrop || modifierKeys.forceStereoDrop) {
      console.log(
        `Sample has ${channels} channel(s), defaultToMonoSamples: ${defaultToMonoSamples}, ` +
          `override: ${modifierKeys.forceMonoDrop ? "force mono" : "force stereo"}`,
      );
    } else {
      console.log(
        `Sample has ${channels} channel(s), defaultToMonoSamples: ${defaultToMonoSamples}`,
      );
    }

    const stereoResult = analyzeStereoAssignment(
      voice,
      channels,
      allSamples,
      modifierKeys.forceMonoDrop || modifierKeys.forceStereoDrop
        ? {
            forceMono: modifierKeys.forceMonoDrop,
            forceStereo: modifierKeys.forceStereoDrop,
          }
        : undefined,
    );

    let assignmentOptions = {
      forceMono: stereoResult.assignAsMono,
      replaceExisting: false,
      cancel: false,
    };

    if (stereoResult.requiresConfirmation && stereoResult.conflictInfo) {
      assignmentOptions = await handleStereoConflict(stereoResult.conflictInfo);
    }

    if (assignmentOptions.cancel) {
      return false;
    }

    return await executeAssignment(
      filePath,
      stereoResult,
      assignmentOptions,
      droppedSlotIndex,
    );
  };

  const executeAssignment = async (
    filePath: string,
    stereoResult: any,
    assignmentOptions: any,
    droppedSlotIndex: number,
  ): Promise<boolean> => {
    const existingSample = samples[droppedSlotIndex];

    if (existingSample && onSampleReplace) {
      await onSampleReplace(voice, droppedSlotIndex, filePath);
      return true;
    }

    if (!existingSample && onSampleAdd) {
      return await applyStereoAssignment(
        filePath,
        stereoResult,
        assignmentOptions,
        async (targetVoice: number, slotIndex: number, path: string) => {
          const targetSlot = calculateTargetSlot(
            path,
            slotIndex,
            droppedSlotIndex,
          );
          if (targetSlot === -1) {
            throw new Error(`No available slots in voice ${targetVoice}`);
          }
          await onSampleAdd(targetVoice, targetSlot, path);
        },
      );
    }

    return false;
  };

  const calculateTargetSlot = (
    path: string,
    slotIndex: number,
    droppedSlotIndex: number,
  ): number => {
    const isFromLocalStore = path.includes(kitName);
    let targetSlot = slotIndex >= 0 ? slotIndex : droppedSlotIndex;

    if (!isFromLocalStore && slotIndex < 0) {
      for (let i = 0; i < 12; i++) {
        if (!samples[i]) {
          return i;
        }
      }
      return -1;
    }

    return targetSlot;
  };

  const calculateDragStyling = (params: {
    isDragOver: boolean;
    isDropZone: boolean;
    isStereoHighlight: boolean;
    dropMode?: string;
    sample?: string;
    voice: number;
    defaultToMonoSamples: boolean;
  }) => {
    let dragOverClass = "";
    let dropHintTitle = "Drop to assign sample";

    if (!params.isDragOver && !params.isStereoHighlight && !params.isDropZone) {
      return { dragOverClass, dropHintTitle };
    }

    if (params.isDropZone) {
      if (params.dropMode === "insert") {
        dragOverClass =
          " bg-green-100 dark:bg-green-800 ring-2 ring-green-400 dark:ring-green-300 border-t-4 border-green-500";
        dropHintTitle = "Insert sample here (other samples will shift down)";
      } else {
        dragOverClass =
          " bg-yellow-100 dark:bg-yellow-800 ring-2 ring-yellow-400 dark:ring-yellow-300";
        dropHintTitle = params.sample
          ? "Replace this sample"
          : "Move sample here";
      }
    } else if (params.isStereoHighlight) {
      dragOverClass =
        " bg-purple-100 dark:bg-purple-800 ring-2 ring-purple-400 dark:ring-purple-300";
      dropHintTitle =
        params.voice > 1
          ? "Right channel of stereo pair"
          : "Left channel of stereo pair";
    } else {
      dragOverClass =
        " bg-orange-100 dark:bg-orange-800 ring-2 ring-orange-400 dark:ring-orange-300";
      dropHintTitle = `Drop to assign sample (default: ${params.defaultToMonoSamples ? "mono" : "stereo"})`;
    }

    return { dragOverClass, dropHintTitle };
  };

  React.useEffect(() => {
    setEditValue(voiceName || "");
  }, [voiceName]);

  const handleSave = () => {
    onSaveVoiceName(voice, editValue.trim());
    setEditing(false);
  };
  const handleCancel = () => {
    setEditValue(voiceName || "");
    setEditing(false);
  };

  // Keyboard navigation for sample slots
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    setEditValue(voiceName || "");
  }, [voiceName]);

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

  // Only handle Enter/Space for play when focused, not up/down navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (!samples.length) return;
    if (!isActive) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const sample = samples[selectedIdx];
      onPlay(voice, sample);
    }
  };

  // Drag-and-drop handlers for Task 5.2.2
  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    if (!isEditable) return;

    e.preventDefault();

    // Task 7.1.3: Show different drop effect based on modifier keys
    const isForcedStereo = e.altKey || e.metaKey;
    const isForcedMono = e.shiftKey;

    if (isForcedMono) {
      e.dataTransfer.dropEffect = "link"; // Visual hint for force mono
    } else if (isForcedStereo) {
      e.dataTransfer.dropEffect = "move"; // Visual hint for force stereo
    } else {
      e.dataTransfer.dropEffect = "copy"; // Normal behavior
    }

    setDragOverSlot(slotIndex);

    // Notify parent about potential stereo drop
    if (onStereoDragOver) {
      const willBeStereo =
        isForcedStereo || (!isForcedMono && !defaultToMonoSamples);
      onStereoDragOver(voice, slotIndex, willBeStereo);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the slot area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSlot(null);
      if (onStereoDragLeave) {
        onStereoDragLeave();
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, droppedSlotIndex: number) => {
    if (!isEditable) return;

    e.preventDefault();
    setDragOverSlot(null);

    if (onStereoDragLeave) {
      onStereoDragLeave();
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      console.warn("No files dropped");
      return;
    }

    const file = files[0];
    const modifierKeys = {
      forceStereoDrop: e.altKey || e.metaKey,
      forceMonoDrop: e.shiftKey,
    };

    try {
      const filePath = await getFilePathFromDrop(file);
      const formatValidation = await validateDroppedFile(filePath);

      if (!formatValidation) return;

      const allSamples = await getCurrentKitSamples();
      if (!allSamples) return;

      if (await isDuplicateSample(allSamples, filePath)) return;

      const assignmentResult = await processAssignment(
        filePath,
        formatValidation,
        allSamples,
        modifierKeys,
        droppedSlotIndex,
      );

      if (!assignmentResult) return;
    } catch (error) {
      console.error("Failed to assign sample:", error);
    }
  };

  const handleDeleteSample = async (slotIndex: number) => {
    if (!isEditable || !onSampleDelete) return;

    try {
      await onSampleDelete(voice, slotIndex);
    } catch (error) {
      console.error("Failed to delete sample:", error);
      // Could show error message here
    }
  };

  // Task 22.2: Internal sample drag handlers
  const handleSampleDragStart = (
    e: React.DragEvent,
    slotIndex: number,
    sampleName: string,
  ) => {
    if (!isEditable) return;

    // Set the dragged sample data
    setDraggedSample({ voice, slot: slotIndex, sampleName });

    // Set drag effect to move
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/x-romper-sample",
      JSON.stringify({
        voice,
        slot: slotIndex,
        sampleName,
      }),
    );

    // Add visual feedback - make the dragged element semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleSampleDragEnd = (e: React.DragEvent) => {
    // Reset drag state
    setDraggedSample(null);
    setDropZone(null);

    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleSampleDragOver = (e: React.DragEvent, slotIndex: number) => {
    if (!isEditable) return;

    // Check if this is an internal sample drag
    const romperSampleData = e.dataTransfer.types.includes(
      "application/x-romper-sample",
    );
    if (romperSampleData) {
      // Calculate drop mode based on cursor position within the slot
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      const dropMode = y < height * 0.3 ? "insert" : "overwrite";

      // No need for complex validation - only valid drop targets are rendered

      e.preventDefault();
      e.stopPropagation();

      setDropZone({ slot: slotIndex, mode: dropMode });
      return;
    }

    // No need for validation - only valid drop targets are rendered

    // Fall back to existing external file drag handling
    handleDragOver(e, slotIndex);
  };

  const handleSampleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the slot area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropZone(null);
    }

    // Fall back to existing drag leave handling
    handleDragLeave(e);
  };

  const handleSampleDrop = async (
    e: React.DragEvent,
    droppedSlotIndex: number,
  ) => {
    if (!isEditable) return;

    // Check if this is an internal sample drag
    const romperSampleDataStr = e.dataTransfer.getData(
      "application/x-romper-sample",
    );
    if (romperSampleDataStr && onSampleMove) {
      e.preventDefault();
      e.stopPropagation();

      try {
        const dragData = JSON.parse(romperSampleDataStr);
        const dropMode = dropZone?.mode || "overwrite";

        // Don't allow dropping on the same slot
        if (dragData.voice === voice && dragData.slot === droppedSlotIndex) {
          return;
        }

        // No validation needed - only valid drop targets are rendered

        await onSampleMove(
          dragData.voice,
          dragData.slot,
          voice,
          droppedSlotIndex,
          dropMode,
        );
      } catch (error) {
        console.error("Failed to move sample:", error);
        toast.error("Failed to move sample", {
          description: error instanceof Error ? error.message : String(error),
          duration: 3000,
        });
      } finally {
        setDraggedSample(null);
        setDropZone(null);
      }
      return;
    }

    // Fall back to existing external file drop handling
    await handleDrop(e, droppedSlotIndex);
  };

  // Helper function to calculate render slots
  const calculateRenderSlots = () => {
    const lastSampleIndex = samples
      .map((sample, index) => (sample !== "" ? index : -1))
      .reduce((max, current) => Math.max(max, current), -1);
    const nextAvailableSlot = lastSampleIndex + 1;
    const slotsToRender = Math.min(nextAvailableSlot + 1, 12); // Show samples + 1 drop target, max 12
    return { nextAvailableSlot, slotsToRender };
  };

  // Helper function to calculate slot styling and drag feedback
  const getSlotStyling = (slotIndex: number, sample: string | undefined) => {
    const slotBaseClass = "truncate flex items-center gap-2 mb-1 min-h-[28px]";
    const isDragOver = dragOverSlot === slotIndex;
    const isDropZone = dropZone?.slot === slotIndex;
    const isStereoHighlight =
      isStereoDragTarget && stereoDragSlotIndex === slotIndex;

    const dragStyling = calculateDragStyling({
      isDragOver,
      isDropZone,
      isStereoHighlight,
      dropMode: dropZone?.mode,
      sample,
      voice,
      defaultToMonoSamples,
    });

    return {
      slotBaseClass,
      dragOverClass: dragStyling.dragOverClass,
      dropHintTitle: dragStyling.dropHintTitle,
      isDragOver,
      isDropZone,
      isStereoHighlight,
    };
  };

  // Helper function to render a filled sample slot
  const renderSampleSlot = (slotIndex: number, sample: string) => {
    const {
      slotBaseClass,
      dragOverClass,
      dropHintTitle,
      isDragOver,
      isDropZone,
      isStereoHighlight,
    } = getSlotStyling(slotIndex, sample);
    const sampleName = sample;
    const sampleKey = voice + ":" + sampleName;
    const isPlaying = samplePlaying[sampleKey];
    const slotNumber = slotIndex + 1;
    const sampleData = sampleMetadata?.[sampleName];

    return (
      <li
        key={`${voice}-${slotIndex}-${sampleName}`}
        className={`${slotBaseClass}${
          selectedIdx === slotIndex && isActive
            ? " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold ring-2 ring-blue-400 dark:ring-blue-300"
            : ""
        }${dragOverClass}`}
        tabIndex={-1}
        aria-selected={selectedIdx === slotIndex && isActive}
        data-testid={
          selectedIdx === slotIndex && isActive
            ? `sample-selected-voice-${voice}`
            : undefined
        }
        title={
          isDragOver || isStereoHighlight || isDropZone
            ? dropHintTitle
            : `Slot ${slotNumber}${sampleData?.source_path ? `\nSource: ${sampleData.source_path}` : ""}`
        }
        onClick={() => onSampleSelect && onSampleSelect(voice, slotIndex)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (sampleData?.source_path && window.electronAPI?.showItemInFolder) {
            window.electronAPI.showItemInFolder(sampleData.source_path);
          }
        }}
        draggable={isEditable}
        onDragStart={
          isEditable
            ? (e) => handleSampleDragStart(e, slotIndex, sampleName)
            : undefined
        }
        onDragEnd={isEditable ? handleSampleDragEnd : undefined}
        onDragOver={
          isEditable ? (e) => handleSampleDragOver(e, slotIndex) : undefined
        }
        onDragLeave={isEditable ? handleSampleDragLeave : undefined}
        onDrop={isEditable ? (e) => handleSampleDrop(e, slotIndex) : undefined}
      >
        {renderPlayButton(isPlaying, sampleName)}
        <span
          className="truncate text-xs font-mono font-medium text-gray-700 dark:text-gray-200 flex-1"
          title={
            sampleData?.source_path
              ? `${sampleName}\nSource: ${sampleData.source_path}`
              : sampleName
          }
        >
          {sampleName}
        </span>
        {isEditable && renderDeleteButton(slotIndex)}
        <SampleWaveform
          key={`${kitName}-${voice}-${slotIndex}-${sampleName}`}
          kitName={kitName}
          voiceNumber={voice}
          slotNumber={slotNumber}
          playTrigger={playTriggers[sampleKey] || 0}
          stopTrigger={stopTriggers[sampleKey] || 0}
          onPlayingChange={(playing) =>
            onWaveformPlayingChange(voice, sample, playing)
          }
          onError={(err) => {
            if (typeof window !== "undefined" && window.dispatchEvent) {
              window.dispatchEvent(
                new CustomEvent("SampleWaveformError", { detail: err }),
              );
            }
          }}
        />
      </li>
    );
  };

  // Helper function to render play/stop button
  const renderPlayButton = (isPlaying: boolean, sampleName: string) => {
    const buttonStyle = {
      minWidth: 24,
      minHeight: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    if (isPlaying) {
      return (
        <button
          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs text-red-600 dark:text-red-400"
          onClick={() => onStop(voice, sampleName)}
          aria-label="Stop"
          style={buttonStyle}
        >
          <FiSquare />
        </button>
      );
    }

    return (
      <button
        className="p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs"
        onClick={() => onPlay(voice, sampleName)}
        aria-label="Play"
        style={buttonStyle}
      >
        <FiPlay />
      </button>
    );
  };

  // Helper function to render delete button
  const renderDeleteButton = (slotIndex: number) => (
    <button
      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-800 text-xs text-red-600 dark:text-red-400 ml-2"
      onClick={(e) => {
        e.stopPropagation();
        handleDeleteSample(slotIndex);
      }}
      aria-label="Delete sample"
      title="Delete sample"
      style={{
        minWidth: 24,
        minHeight: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FiTrash2 />
    </button>
  );

  // Helper function to render an empty slot
  const renderEmptySlot = (slotIndex: number, isDropTarget: boolean) => {
    const {
      slotBaseClass,
      dragOverClass,
      dropHintTitle,
      isDragOver,
      isDropZone,
      isStereoHighlight,
    } = getSlotStyling(slotIndex, undefined);

    return (
      <li
        key={`${voice}-empty-${slotIndex}`}
        className={`${slotBaseClass} text-gray-400 dark:text-gray-600 italic${dragOverClass}${
          isEditable
            ? " border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500"
            : ""
        }`}
        tabIndex={-1}
        aria-selected={false}
        data-testid={`empty-slot-${voice}-${slotIndex}`}
        title={
          isDragOver || isStereoHighlight || isDropZone
            ? dropHintTitle
            : undefined
        }
        onClick={() => onSampleSelect && onSampleSelect(voice, slotIndex)}
        onDragOver={
          isEditable && isDropTarget
            ? (e) => handleSampleDragOver(e, slotIndex)
            : undefined
        }
        onDragLeave={
          isEditable && isDropTarget ? handleSampleDragLeave : undefined
        }
        onDrop={
          isEditable && isDropTarget
            ? (e) => handleSampleDrop(e, slotIndex)
            : undefined
        }
      >
        <div className="flex-1 flex items-center justify-center">
          {isEditable ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Drop WAV file here
            </span>
          ) : (
            <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
          )}
        </div>
      </li>
    );
  };

  // Main render function for all sample slots
  const renderSampleSlots = () => {
    const { nextAvailableSlot, slotsToRender } = calculateRenderSlots();
    const renderedSlots = [];

    for (let i = 0; i < slotsToRender; i++) {
      const sample = samples[i];
      const isDropTarget = i === nextAvailableSlot;

      if (sample) {
        renderedSlots.push(renderSampleSlot(i, sample));
      } else if (isDropTarget) {
        renderedSlots.push(renderEmptySlot(i, isDropTarget));
      }
    }

    return renderedSlots;
  };

  return (
    <div className="flex flex-col" role="region">
      <div className="font-semibold mb-1 text-gray-800 dark:text-gray-100 pl-1 flex items-center gap-2">
        <span>{voice}:</span>
        {editing ? (
          <>
            <input
              className="ml-1 px-2 py-0.5 rounded border border-blue-400 text-sm font-semibold bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-100 w-32"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <button
              className="ml-1 text-green-600 dark:text-green-400"
              onClick={handleSave}
              title="Save"
            >
              <FiCheck />
            </button>
            <button
              className="ml-1 text-red-600 dark:text-red-400"
              onClick={handleCancel}
              title="Cancel"
            >
              <FiX />
            </button>
          </>
        ) : (
          <>
            <span
              className={
                voiceName
                  ? "ml-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-sm font-semibold tracking-wide"
                  : "ml-1 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold tracking-wide italic"
              }
              data-testid={dataTestIdVoiceName || `voice-name-${voice}`}
            >
              {voiceName ? toCapitalCase(voiceName) : "No voice name set"}
            </span>
            {isEditable && (
              <button
                className="ml-1 text-blue-600 dark:text-blue-300"
                onClick={() => setEditing(true)}
                title="Edit voice name"
              >
                <FiEdit2 />
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex flex-1">
        {/* Slot numbers column */}
        <div className="flex flex-col justify-start pt-3 pr-2">
          {(() => {
            const lastSampleIndex = samples
              .map((sample, index) => (sample !== "" ? index : -1))
              .reduce((max, current) => Math.max(max, current), -1);
            const nextAvailableSlot = lastSampleIndex + 1;
            const slotsToRender = Math.min(nextAvailableSlot + 1, 12);

            return [...Array(slotsToRender)].map((_, i) => (
              <div
                key={`slot-${i}`}
                className="min-h-[28px] flex items-center justify-end"
                style={{ marginBottom: 4 }}
              >
                <span
                  className="text-xs font-mono text-gray-500 dark:text-gray-400 select-none bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-center w-8 h-5 flex items-center justify-center inline-block"
                  data-testid={`slot-number-${voice}-${i}`}
                  style={{ width: "32px", display: "inline-block" }}
                >
                  {i + 1}.
                </span>
              </div>
            ));
          })()}
        </div>

        {/* Voice panel content */}
        <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
          <ul
            className="list-none ml-0 text-sm flex flex-col"
            ref={listRef}
            aria-label="Sample slots"
            data-testid={`sample-list-voice-${voice}`}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={handleKeyDown}
          >
            {renderSampleSlots()}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KitVoicePanel;

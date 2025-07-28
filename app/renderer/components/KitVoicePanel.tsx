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
import SampleWaveform from "./SampleWaveform";

interface KitVoicePanelProps {
  voice: number;
  samples: string[];
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
}

const KitVoicePanel: React.FC<
  KitVoicePanelProps & { dataTestIdVoiceName?: string }
> = ({
  voice,
  samples,
  voiceName,
  onSaveVoiceName,
  onRescanVoiceName,
  samplePlaying,
  playTriggers,
  stopTriggers,
  onPlay,
  onStop,
  onWaveformPlayingChange,
  kitName,
  dataTestIdVoiceName,
  selectedIdx = -1,
  onSampleKeyNav,
  onSampleSelect,
  isActive = false,
  isEditable = true,
  onSampleAdd,
  onSampleReplace,
  onSampleDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(voiceName || "");
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

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
    e.dataTransfer.dropEffect = "copy";
    setDragOverSlot(slotIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the slot area
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSlot(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, droppedSlotIndex: number) => {
    if (!isEditable) return;

    e.preventDefault();
    setDragOverSlot(null);

    const files = Array.from(e.dataTransfer.files);

    if (files.length === 0) {
      console.warn("No files dropped");
      return;
    }

    // Use the first file found - let format validation handle file type checking
    const file = files[0];

    try {
      // Get the full file path using Electron's webUtils
      let filePath: string;
      if (window.electronFileAPI?.getDroppedFilePath) {
        filePath = await window.electronFileAPI.getDroppedFilePath(file);
      } else {
        // Fallback for non-Electron environments
        filePath = (file as any).path || file.name;
      }

      // Task 6.1: Validate file format before assignment via IPC
      if (!window.electronAPI?.validateSampleFormat) {
        console.error("Format validation not available");
        return;
      }

      const formatValidationResult =
        await window.electronAPI.validateSampleFormat(filePath);
      if (!formatValidationResult.success || !formatValidationResult.data) {
        console.error(
          "Format validation failed:",
          formatValidationResult.error,
        );
        return;
      }

      const formatValidation = formatValidationResult.data;
      if (!formatValidation.isValid) {
        // Check for critical issues that prevent assignment
        const criticalIssues = formatValidation.issues.filter(
          (issue) =>
            issue.type === "extension" ||
            issue.type === "fileAccess" ||
            issue.type === "invalidFormat",
        );

        if (criticalIssues.length > 0) {
          // Critical issues prevent assignment entirely
          const errorMessage = criticalIssues.map((i) => i.message).join(", ");
          console.error(
            "Cannot assign sample due to critical format issues:",
            errorMessage,
          );

          // Show user-friendly error toast
          toast.error("Cannot assign sample", {
            description: errorMessage,
            duration: 5000,
          });
          return;
        } else {
          // Non-critical issues allow assignment but show warnings
          const warningMessage = formatValidation.issues
            .map((i) => i.message)
            .join(", ");
          console.warn(
            "Sample has format issues that will require conversion during SD card sync:",
            warningMessage,
          );

          // Show format warning toast
          toast.warning("Sample format warning", {
            description: `${warningMessage} The sample will be converted during SD card sync.`,
            duration: 7000,
          });
          // Proceed with assignment
        }
      }

      // Get current sample data for this kit to check for duplicates and find available slots
      if (!window.electronAPI?.getAllSamplesForKit) {
        console.error("Sample management not available");
        return;
      }

      const samplesResult =
        await window.electronAPI.getAllSamplesForKit(kitName);
      if (!samplesResult.success) {
        console.error("Failed to get samples:", samplesResult.error);
        return;
      }

      const allSamples = samplesResult.data || [];
      const voiceSamples = allSamples.filter(
        (s: any) => s.voice_number === voice,
      );

      // Check for duplicate source path in this voice
      const isDuplicate = voiceSamples.some(
        (s: any) => s.source_path === filePath,
      );
      if (isDuplicate) {
        console.warn(
          `Sample with path ${filePath} already exists in voice ${voice}`,
        );
        // Could show error message here
        return;
      }

      // Determine if we should add or replace
      const existingSample = samples[droppedSlotIndex];

      if (existingSample && onSampleReplace) {
        // Replace the sample in the exact slot where it was dropped
        await onSampleReplace(voice, droppedSlotIndex, filePath);
      } else if (!existingSample && onSampleAdd) {
        // For external samples (not from local store), find the next available slot
        // For local store samples, preserve slot order
        const isFromLocalStore = filePath.includes(kitName); // Simple heuristic

        let targetSlot = droppedSlotIndex;
        if (!isFromLocalStore) {
          // Find next available slot for external samples
          targetSlot = -1;
          for (let i = 0; i < 12; i++) {
            if (!samples[i]) {
              targetSlot = i;
              break;
            }
          }

          if (targetSlot === -1) {
            console.warn(`No available slots in voice ${voice}`);
            return;
          }
        }

        await onSampleAdd(voice, targetSlot, filePath);
      }
    } catch (error) {
      console.error("Failed to assign sample:", error);
      // Could show error message here
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
      <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
        <ul
          className="list-none ml-0 text-sm flex flex-col"
          ref={listRef}
          aria-label="Sample slots"
          data-testid={`sample-list-voice-${voice}`}
          tabIndex={isActive ? 0 : -1}
          onKeyDown={handleKeyDown}
        >
          {[...Array(12)].map((_, i) => {
            const sample = samples[i];
            const slotBaseClass =
              "truncate flex items-center gap-2 mb-1 min-h-[28px]"; // uniform height for all slots
            const isDragOver = dragOverSlot === i;
            const dragOverClass = isDragOver
              ? " bg-orange-100 dark:bg-orange-800 ring-2 ring-orange-400 dark:ring-orange-300"
              : "";

            if (sample) {
              const sampleKey = voice + ":" + sample;
              const isPlaying = samplePlaying[sampleKey];
              const slotNumber = i + 1; // Convert 0-based index to 1-based slot
              return (
                <li
                  key={`${voice}-${i}-${sample}`}
                  className={`${slotBaseClass}${
                    selectedIdx === i && isActive
                      ? " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold ring-2 ring-blue-400 dark:ring-blue-300"
                      : ""
                  }${dragOverClass}`}
                  tabIndex={-1}
                  aria-selected={selectedIdx === i && isActive}
                  data-testid={
                    selectedIdx === i && isActive
                      ? `sample-selected-voice-${voice}`
                      : undefined
                  }
                  onClick={() => onSampleSelect && onSampleSelect(voice, i)}
                  onDragOver={
                    isEditable ? (e) => handleDragOver(e, i) : undefined
                  }
                  onDragLeave={isEditable ? handleDragLeave : undefined}
                  onDrop={isEditable ? (e) => handleDrop(e, i) : undefined}
                >
                  <span
                    className="text-xs font-mono text-gray-500 dark:text-gray-400 px-1 select-none inline-block align-right"
                    style={{
                      minWidth: 32,
                      textAlign: "right",
                      display: "inline-block",
                    }}
                    data-testid={`slot-number-${voice}-${i}`}
                  >
                    {i + 1}.
                  </span>
                  {/* Slot number, always visible, not part of sample name */}
                  {isPlaying ? (
                    <button
                      className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs text-red-600 dark:text-red-400`}
                      onClick={() => onStop(voice, sample)}
                      aria-label="Stop"
                      style={{
                        minWidth: 24,
                        minHeight: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FiSquare />
                    </button>
                  ) : (
                    <button
                      className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs ${
                        isPlaying ? "text-green-600 dark:text-green-400" : ""
                      }`}
                      onClick={() => onPlay(voice, sample)}
                      aria-label="Play"
                      style={{
                        minWidth: 24,
                        minHeight: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FiPlay />
                    </button>
                  )}
                  <span
                    className="truncate text-xs font-mono text-gray-800 dark:text-gray-100 flex-1"
                    title={sample}
                  >
                    {sample}
                  </span>
                  {isEditable && (
                    <button
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-800 text-xs text-red-600 dark:text-red-400 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSample(i);
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
                  )}
                  <SampleWaveform
                    key={`${kitName}-${voice}-${i}-${sample}`}
                    kitName={kitName}
                    voiceNumber={voice}
                    slotNumber={slotNumber}
                    playTrigger={playTriggers[sampleKey] || 0}
                    stopTrigger={stopTriggers[sampleKey] || 0}
                    onPlayingChange={(playing) =>
                      onWaveformPlayingChange(voice, sample, playing)
                    }
                    onError={(err) => {
                      // Bubble up error to parent if needed (to be handled in KitDetails)
                      if (
                        typeof window !== "undefined" &&
                        window.dispatchEvent
                      ) {
                        window.dispatchEvent(
                          new CustomEvent("SampleWaveformError", {
                            detail: err,
                          }),
                        );
                      }
                    }}
                  />
                </li>
              );
            } else {
              // Empty slot
              return (
                <li
                  key={`${voice}-empty-${i}`}
                  className={`${slotBaseClass} text-gray-400 dark:text-gray-600 italic${dragOverClass}${
                    isEditable
                      ? " border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500"
                      : ""
                  }`}
                  tabIndex={-1}
                  aria-selected={false}
                  data-testid={`empty-slot-${voice}-${i}`}
                  onClick={() => onSampleSelect && onSampleSelect(voice, i)}
                  onDragOver={
                    isEditable ? (e) => handleDragOver(e, i) : undefined
                  }
                  onDragLeave={isEditable ? handleDragLeave : undefined}
                  onDrop={isEditable ? (e) => handleDrop(e, i) : undefined}
                >
                  <span
                    className="text-xs font-mono text-gray-500 dark:text-gray-400 px-1 select-none inline-block align-right"
                    style={{
                      minWidth: 32,
                      textAlign: "right",
                      display: "inline-block",
                    }}
                    data-testid={`slot-number-${voice}-${i}`}
                  >
                    {i + 1}.
                  </span>
                  <span className="ml-2 flex-1">
                    {isEditable ? "Drop WAV file here or (empty)" : "(empty)"}
                  </span>
                </li>
              );
            }
          })}
        </ul>
      </div>
    </div>
  );
};

export default KitVoicePanel;

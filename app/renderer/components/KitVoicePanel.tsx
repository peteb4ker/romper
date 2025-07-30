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
  isStereoDragTarget = false,
  stereoDragSlotIndex,
  onStereoDragOver,
  onStereoDragLeave,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(voiceName || "");
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // Task 7.1.2: Get defaultToMonoSamples setting and stereo handling logic
  const { defaultToMonoSamples } = useSettings();
  const {
    analyzeStereoAssignment,
    handleStereoConflict,
    applyStereoAssignment,
  } = useStereoHandling();

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

    // Clear stereo drag state
    if (onStereoDragLeave) {
      onStereoDragLeave();
    }

    const files = Array.from(e.dataTransfer.files);

    if (files.length === 0) {
      console.warn("No files dropped");
      return;
    }

    // Use the first file found - let format validation handle file type checking
    const file = files[0];

    // Task 7.1.3: Check for modifier keys to override defaultToMonoSamples
    const forceStereoDrop = e.altKey || e.metaKey; // Alt/Option or Cmd (Mac) forces stereo
    const forceMonoDrop = e.shiftKey; // Shift forces mono

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

      // Task 7.1.2 & 7.2: Apply stereo handling logic based on metadata
      const channels = formatValidation.metadata?.channels || 1;

      // Task 7.1.3: Log modifier key overrides
      if (forceMonoDrop || forceStereoDrop) {
        console.log(
          `Sample has ${channels} channel(s), defaultToMonoSamples: ${defaultToMonoSamples}, ` +
            `override: ${forceMonoDrop ? "force mono" : "force stereo"}`,
        );
      } else {
        console.log(
          `Sample has ${channels} channel(s), defaultToMonoSamples: ${defaultToMonoSamples}`,
        );
      }

      // Get current sample data for this kit to check for duplicates and stereo conflicts
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
        toast.warning("Duplicate sample", {
          description: `Sample already exists in voice ${voice}`,
          duration: 5000,
        });
        return;
      }

      // Task 7.2: Analyze stereo assignment requirements
      // Task 7.1.3: Pass modifier key overrides
      const stereoResult = analyzeStereoAssignment(
        voice,
        channels,
        allSamples,
        forceMonoDrop || forceStereoDrop
          ? { forceMono: forceMonoDrop, forceStereo: forceStereoDrop }
          : undefined,
      );

      // Task 7.3: Handle stereo conflicts if needed
      let assignmentOptions = {
        forceMono: stereoResult.assignAsMono,
        replaceExisting: false,
        cancel: false,
      };

      if (stereoResult.requiresConfirmation && stereoResult.conflictInfo) {
        assignmentOptions = await handleStereoConflict(
          stereoResult.conflictInfo,
        );
      }

      if (assignmentOptions.cancel) {
        return;
      }

      // Determine if we should add or replace based on existing content in the slot
      const existingSample = samples[droppedSlotIndex];

      if (existingSample && onSampleReplace) {
        // Replace the sample in the exact slot where it was dropped
        await onSampleReplace(voice, droppedSlotIndex, filePath);
      } else if (!existingSample && onSampleAdd) {
        // Task 7.3.2: Apply stereo assignment choice
        const success = await applyStereoAssignment(
          filePath,
          stereoResult,
          assignmentOptions,
          async (targetVoice: number, slotIndex: number, path: string) => {
            // For external samples (not from local store), find the next available slot
            // For local store samples, preserve slot order
            const isFromLocalStore = path.includes(kitName); // Simple heuristic

            let targetSlot = slotIndex >= 0 ? slotIndex : droppedSlotIndex;
            if (!isFromLocalStore && slotIndex < 0) {
              // Find next available slot for external samples
              targetSlot = -1;
              for (let i = 0; i < 12; i++) {
                if (!samples[i]) {
                  targetSlot = i;
                  break;
                }
              }

              if (targetSlot === -1) {
                throw new Error(`No available slots in voice ${targetVoice}`);
              }
            }

            await onSampleAdd(targetVoice, targetSlot, path);
          },
        );

        if (!success) {
          // Error already handled in applyStereoAssignment
          return;
        }
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
      <div className="flex flex-1">
        {/* Slot numbers column */}
        <div className="flex flex-col justify-start pt-3 pr-2">
          {[...Array(12)].map((_, i) => (
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
          ))}
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
            {[...Array(12)].map((_, i) => {
              const sample = samples[i];
              const slotBaseClass =
                "truncate flex items-center gap-2 mb-1 min-h-[28px]"; // uniform height for all slots
              const isDragOver = dragOverSlot === i;

              // Task 7.1.3: Different visual feedback for modifier key overrides
              let dragOverClass = "";
              let dropHintTitle = "Drop to assign sample";

              // Check if this slot should be highlighted for stereo drop
              const isStereoHighlight =
                isStereoDragTarget && stereoDragSlotIndex === i;

              if (isDragOver || isStereoHighlight) {
                if (isStereoHighlight) {
                  dragOverClass =
                    " bg-purple-100 dark:bg-purple-800 ring-2 ring-purple-400 dark:ring-purple-300";
                  dropHintTitle =
                    isStereoDragTarget && stereoDragSlotIndex === i && voice > 1
                      ? "Right channel of stereo pair"
                      : "Left channel of stereo pair";
                } else {
                  dragOverClass =
                    " bg-orange-100 dark:bg-orange-800 ring-2 ring-orange-400 dark:ring-orange-300";
                  dropHintTitle = `Drop to assign sample (default: ${defaultToMonoSamples ? "mono" : "stereo"})`;
                }
              }

              if (sample) {
                // sample is now always a string (filename)
                const sampleName = sample;
                const sampleKey = voice + ":" + sampleName;
                const isPlaying = samplePlaying[sampleKey];
                const slotNumber = i + 1; // Convert 0-based index to 1-based slot
                const sampleData = sampleMetadata?.[sampleName]; // Get metadata if available
                return (
                  <li
                    key={`${voice}-${i}-${sampleName}`}
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
                    title={
                      isDragOver || isStereoHighlight
                        ? dropHintTitle
                        : `Slot ${slotNumber}${sampleData?.source_path ? `\nSource: ${sampleData.source_path}` : ""}`
                    }
                    onClick={() => onSampleSelect && onSampleSelect(voice, i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (
                        sampleData?.source_path &&
                        window.electronAPI?.showItemInFolder
                      ) {
                        window.electronAPI.showItemInFolder(
                          sampleData.source_path,
                        );
                      }
                    }}
                    onDragOver={
                      isEditable ? (e) => handleDragOver(e, i) : undefined
                    }
                    onDragLeave={isEditable ? handleDragLeave : undefined}
                    onDrop={isEditable ? (e) => handleDrop(e, i) : undefined}
                  >
                    {isPlaying ? (
                      <button
                        className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs text-red-600 dark:text-red-400`}
                        onClick={() => onStop(voice, sampleName)}
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
                        onClick={() => onPlay(voice, sampleName)}
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
                    {/* Primary: Show filename prominently */}
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
                      key={`${kitName}-${voice}-${i}-${sampleName}`}
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
                    title={
                      isDragOver || isStereoHighlight
                        ? dropHintTitle
                        : undefined
                    }
                    onClick={() => onSampleSelect && onSampleSelect(voice, i)}
                    onDragOver={
                      isEditable ? (e) => handleDragOver(e, i) : undefined
                    }
                    onDragLeave={isEditable ? handleDragLeave : undefined}
                    onDrop={isEditable ? (e) => handleDrop(e, i) : undefined}
                  >
                    <div className="flex-1 flex items-center">
                      {isEditable ? (
                        <>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            Drop WAV file here
                          </span>
                          <div className="ml-2 w-2 h-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-sm"></div>
                        </>
                      ) : (
                        <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
                      )}
                    </div>
                  </li>
                );
              }
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KitVoicePanel;

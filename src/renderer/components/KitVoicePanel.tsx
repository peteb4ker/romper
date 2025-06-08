import React, { useState } from "react";
import {
  FiCheck,
  FiEdit2,
  FiPlay,
  FiRefreshCw,
  FiSquare,
  FiX,
} from "react-icons/fi";

import { toCapitalCase } from "./kitUtils";
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
  sdCardPath: string;
  kitName: string;

  // New props for cross-voice navigation
  selectedIdx?: number; // index of selected sample in this voice, or -1 if not active
  onSampleKeyNav?: (direction: "up" | "down") => void;
  onSampleSelect?: (voice: number, idx: number) => void;
  isActive?: boolean;
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
  sdCardPath,
  kitName,
  dataTestIdVoiceName,
  selectedIdx = -1,
  onSampleKeyNav,
  onSampleSelect,
  isActive = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(voiceName || "");

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
            <button
              className="ml-1 text-blue-600 dark:text-blue-300"
              onClick={() => setEditing(true)}
              title="Edit voice name"
            >
              <FiEdit2 />
            </button>
            <button
              className="ml-1 text-gray-600 dark:text-gray-300"
              onClick={() => onRescanVoiceName(voice)}
              title="Rescan voice name"
            >
              <FiRefreshCw />
            </button>
          </>
        )}
      </div>
      <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
        {samples && samples.length > 0 ? (
          <ul
            className="list-none ml-0 text-sm flex flex-col"
            ref={listRef}
            aria-label="Sample slots"
            data-testid={`sample-list-voice-${voice}`}
            // Only tab-focusable if active
            tabIndex={isActive ? 0 : -1}
            onKeyDown={handleKeyDown}
          >
            {samples.slice(0, 12).map((sample, i) => {
              const sampleKey = voice + ":" + sample;
              const isPlaying = samplePlaying[sampleKey];
              let filePath = `${sdCardPath}/${kitName}/${sample}`;
              return (
                <li
                  key={`${voice}-${i}-${sample}`}
                  className={`truncate flex items-center gap-2 mb-1${
                    selectedIdx === i && isActive
                      ? " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold ring-2 ring-blue-400 dark:ring-blue-300"
                      : ""
                  }`}
                  tabIndex={-1}
                  aria-selected={selectedIdx === i && isActive}
                  data-testid={
                    selectedIdx === i && isActive
                      ? `sample-selected-voice-${voice}`
                      : undefined
                  }
                  onClick={() => onSampleSelect && onSampleSelect(voice, i)}
                >
                  <span
                    className="text-xs font-mono text-gray-500 dark:text-gray-400 px-1 select-none inline-block align-right"
                    style={{ minWidth: 32, textAlign: 'right', display: 'inline-block' }}
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
                    className="truncate text-xs font-mono text-gray-800 dark:text-gray-100"
                    title={sample}
                  >
                    {sample}
                  </span>
                  <SampleWaveform
                    key={`${kitName}-${voice}-${i}-${sample}`}
                    filePath={filePath}
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
            })}
            {samples.length > 12 && (
              <li className="italic text-xs text-gray-500 dark:text-gray-400">
                ...and more
              </li>
            )}
          </ul>
        ) : (
          <div className="text-gray-400 italic text-sm ml-1">
            No samples assigned
          </div>
        )}
      </div>
    </div>
  );
};

export default KitVoicePanel;

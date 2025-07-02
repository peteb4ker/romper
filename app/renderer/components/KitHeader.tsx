import React from "react";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiFolder,
  FiRefreshCw,
} from "react-icons/fi";

import type { RampleKitLabel } from "./kitTypes";

interface KitHeaderProps {
  kitName: string;
  kitLabel: RampleKitLabel | null;
  editingKitLabel: boolean;
  setEditingKitLabel: (v: boolean) => void;
  kitLabelInput: string;
  setKitLabelInput: (v: string) => void;
  handleSaveKitLabel: (label: string) => void;
  kitLabelInputRef: React.RefObject<HTMLInputElement>;
  onBack?: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  onCreateKit?: () => void;
  onRescanAllVoiceNames?: () => void;
  onScanKit?: () => void;
  kits?: string[];
  kitIndex?: number;
}

const KitHeader: React.FC<KitHeaderProps> = ({
  kitName,
  kitLabel,
  editingKitLabel,
  setEditingKitLabel,
  kitLabelInput,
  setKitLabelInput,
  handleSaveKitLabel,
  kitLabelInputRef,
  onBack,
  onNextKit,
  onPrevKit,
  onCreateKit,
  onRescanAllVoiceNames,
  onScanKit,
  kits,
  kitIndex,
}) => (
  <div className="flex items-center mb-2 gap-2">
    <FiFolder
      className="inline-block mr-2 align-text-bottom text-gray-500 dark:text-gray-400"
      aria-label="Kit folder"
    />
    <span className="font-mono text-base font-bold text-gray-800 dark:text-gray-100 mr-1">
      {kitName}
    </span>
    <span className="text-base font-bold text-gray-800 dark:text-gray-100 mr-1">
      :
    </span>
    {editingKitLabel ? (
      <input
        ref={kitLabelInputRef}
        className="border-b border-blue-500 bg-transparent text-base font-bold text-gray-800 dark:text-gray-100 focus:outline-none px-1 w-48"
        value={kitLabelInput}
        onChange={(e) => setKitLabelInput(e.target.value)}
        onBlur={() => {
          setEditingKitLabel(false);
          handleSaveKitLabel(kitLabelInput.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditingKitLabel(false);
            handleSaveKitLabel(kitLabelInput.trim());
          } else if (e.key === "Escape") {
            setEditingKitLabel(false);
            setKitLabelInput(kitLabel?.label || "");
          }
        }}
        autoFocus
      />
    ) : (
      <span
        className="font-bold text-base text-blue-700 dark:text-blue-300 cursor-pointer hover:underline min-w-[2rem]"
        onClick={() => setEditingKitLabel(true)}
        title="Edit kit name"
      >
        {kitLabel?.label || (
          <span className="italic text-gray-400">(no name)</span>
        )}
      </span>
    )}
    <div className="flex-1" /> {/* Spacer */}
    {onBack && (
      <button
        className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-400 dark:hover:bg-slate-600"
        onClick={() => onBack()}
        title="Back"
      >
        <FiArrowLeft className="inline-block mr-1" /> Back
      </button>
    )}
    {onPrevKit && kits && kitIndex !== undefined && (
      <button
        className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded"
        onClick={onPrevKit}
        title="Previous Kit"
        disabled={kitIndex === 0}
        style={kitIndex === 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
      >
        <FiChevronLeft className="inline-block mr-1" /> Previous
      </button>
    )}
    {onNextKit && kits && kitIndex !== undefined && (
      <button
        className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded"
        onClick={onNextKit}
        title="Next Kit"
        disabled={kitIndex === kits.length - 1}
        style={
          kitIndex === kits.length - 1
            ? { opacity: 0.5, cursor: "not-allowed" }
            : {}
        }
      >
        Next <FiChevronRight className="inline-block ml-1" />
      </button>
    )}
    <div className="flex-1" /> {/* Spacer */}
    {onScanKit && (
      <button
        className="ml-2 px-2 py-1 text-xs bg-green-500 text-white rounded shadow hover:bg-green-700 font-semibold flex items-center"
        onClick={onScanKit}
        title="Perform comprehensive kit scan (voice names, WAV analysis, artist metadata)"
      >
        <FiRefreshCw className="inline-block mr-1" />
        Scan Kit
      </button>
    )}
    <button
      className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded shadow hover:bg-blue-700 font-semibold"
      onClick={onRescanAllVoiceNames}
    >
      Rescan Kit Voice Names
    </button>
  </div>
);

export default KitHeader;

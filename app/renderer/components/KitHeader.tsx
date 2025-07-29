import React from "react";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCircle,
  FiEdit3,
  FiFolder,
  FiLock,
  FiRefreshCw,
} from "react-icons/fi";

import type { Kit, KitWithRelations } from "../../../shared/db/schema";

interface KitHeaderProps {
  kitName: string;
  kit: Kit | null;
  editingKitAlias: boolean;
  setEditingKitAlias: (v: boolean) => void;
  kitAliasInput: string;
  setKitAliasInput: (v: string) => void;
  handleSaveKitAlias: (alias: string) => void;
  kitAliasInputRef: React.RefObject<HTMLInputElement>;
  onBack?: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  onCreateKit?: () => void;
  onScanKit?: () => void;
  onToggleEditableMode?: () => void;
  isEditable?: boolean;
  kits?: KitWithRelations[];
  kitIndex?: number;
}

const KitHeader: React.FC<KitHeaderProps> = ({
  kitName,
  kit,
  editingKitAlias,
  setEditingKitAlias,
  kitAliasInput,
  setKitAliasInput,
  handleSaveKitAlias,
  kitAliasInputRef,
  onBack,
  onNextKit,
  onPrevKit,
  onCreateKit,
  onScanKit,
  onToggleEditableMode,
  isEditable,
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
    {editingKitAlias ? (
      <input
        ref={kitAliasInputRef}
        className="border-b border-blue-500 bg-transparent text-base font-bold text-gray-800 dark:text-gray-100 focus:outline-none px-1 w-48"
        value={kitAliasInput}
        onChange={(e) => setKitAliasInput(e.target.value)}
        onBlur={() => {
          setEditingKitAlias(false);
          handleSaveKitAlias(kitAliasInput.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditingKitAlias(false);
            handleSaveKitAlias(kitAliasInput.trim());
          } else if (e.key === "Escape") {
            setEditingKitAlias(false);
            setKitAliasInput(kit?.alias || "");
          }
        }}
        autoFocus
      />
    ) : (
      <span
        className="font-bold text-base text-blue-700 dark:text-blue-300 cursor-pointer hover:underline min-w-[2rem]"
        onClick={() => setEditingKitAlias(true)}
        title="Edit kit name"
      >
        {kit?.alias || <span className="italic text-gray-400">(no name)</span>}
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
    {onToggleEditableMode && (
      <div className="ml-2 flex items-center gap-2">
        {kit?.modified_since_sync && (
          <div className="flex items-center gap-1 mr-2">
            <FiCircle className="w-3 h-3 text-yellow-500 fill-current" />
            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
              Modified
            </span>
          </div>
        )}
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-12">
          {isEditable ? "Editable" : "Locked"}
        </span>
        <button
          onClick={onToggleEditableMode}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
            isEditable ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
          title={`${isEditable ? "Disable" : "Enable"} editable mode`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
              isEditable ? "translate-x-6" : "translate-x-1"
            }`}
          />
          <span className="sr-only">
            {isEditable ? "Disable" : "Enable"} editable mode
          </span>
        </button>
        {isEditable ? (
          <FiEdit3 className="w-4 h-4 text-orange-500" />
        ) : (
          <FiLock className="w-4 h-4 text-gray-500" />
        )}
      </div>
    )}
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
  </div>
);

export default KitHeader;

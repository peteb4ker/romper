import type { Kit, KitWithRelations } from "@romper/shared/db/schema";

import React from "react";
import {
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiCircle,
  FiEdit3,
  FiLock,
  FiRefreshCw,
} from "react-icons/fi";

interface KitHeaderProps {
  editingKitAlias: boolean;
  handleSaveKitAlias: (alias: string) => void;
  isEditable?: boolean;
  kit: Kit | null;
  kitAliasInput: string;
  kitAliasInputRef: React.RefObject<HTMLInputElement>;
  kitIndex?: number;
  kitName: string;
  kits?: KitWithRelations[];
  onBack?: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  onScanKit?: () => void;
  onToggleEditableMode?: () => void;
  setEditingKitAlias: (v: boolean) => void;
  setKitAliasInput: (v: string) => void;
}

const KitHeader: React.FC<KitHeaderProps> = ({
  editingKitAlias,
  handleSaveKitAlias,
  isEditable,
  kit,
  kitAliasInput,
  kitAliasInputRef,
  kitIndex,
  kitName,
  kits,
  onBack,
  onNextKit,
  onPrevKit,
  onScanKit,
  onToggleEditableMode,
  setEditingKitAlias,
  setKitAliasInput,
}) => (
  <div className="flex items-center mb-2 gap-2">
    {/* Left side: Navigation buttons */}
    <div className="flex items-center gap-2">
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
          className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded w-16"
          disabled={kitIndex === 0}
          onClick={onPrevKit}
          style={kitIndex === 0 ? { cursor: "not-allowed", opacity: 0.5 } : {}}
          title={
            kitIndex > 0
              ? `Previous Kit: ${kits[kitIndex - 1]?.name || ""}`
              : "No previous kit"
          }
        >
          <FiChevronLeft className="inline-block mr-1" />
          {kitIndex > 0 ? kits[kitIndex - 1]?.name || "" : ""}
        </button>
      )}
      {onNextKit && kits && kitIndex !== undefined && (
        <button
          className="px-2 py-1 text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded w-16"
          disabled={kitIndex === kits.length - 1}
          onClick={onNextKit}
          style={
            kitIndex === kits.length - 1
              ? { cursor: "not-allowed", opacity: 0.5 }
              : {}
          }
          title={
            kitIndex < kits.length - 1
              ? `Next Kit: ${kits[kitIndex + 1]?.name || ""}`
              : "No next kit"
          }
        >
          {kitIndex < kits.length - 1 ? kits[kitIndex + 1]?.name || "" : ""}
          <FiChevronRight className="inline-block ml-1" />
        </button>
      )}
    </div>

    {/* Center spacer */}
    <div className="flex-1" />

    {/* Center: Kit name */}
    <div className="flex items-center justify-center gap-2 min-w-0 flex-1">
      <span className="font-sans text-lg font-bold text-gray-900 dark:text-gray-50">
        {kitName}
      </span>
      <span className="text-lg font-bold text-gray-900 dark:text-gray-50">
        :
      </span>
      <div className="min-w-[8rem] flex justify-center">
        {editingKitAlias ? (
          <input
            autoFocus
            className="border-b border-blue-500 bg-transparent text-base font-semibold text-gray-800 dark:text-gray-100 focus:outline-none px-1 w-48 text-center"
            onBlur={() => {
              setEditingKitAlias(false);
              handleSaveKitAlias(kitAliasInput.trim());
            }}
            onChange={(e) => setKitAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditingKitAlias(false);
                handleSaveKitAlias(kitAliasInput.trim());
              } else if (e.key === "Escape") {
                setEditingKitAlias(false);
                setKitAliasInput(kit?.alias || "");
              }
            }}
            ref={kitAliasInputRef}
            value={kitAliasInput}
          />
        ) : (
          <button
            className="font-semibold text-base text-blue-700 dark:text-blue-300 cursor-pointer hover:underline bg-transparent border-none p-0 text-center"
            onClick={() => setEditingKitAlias(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setEditingKitAlias(true);
              }
            }}
            title="Edit kit name"
          >
            {kit?.alias || (
              <span className="italic text-gray-400">(no name)</span>
            )}
          </button>
        )}
      </div>
    </div>

    {/* Right side spacer */}
    <div className="flex-1" />

    {/* Right side: Action buttons */}
    <div className="flex items-center gap-2">
      {onToggleEditableMode && (
        <div className="flex items-center gap-2">
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
              isEditable ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
            onClick={onToggleEditableMode}
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
  </div>
);

export default KitHeader;

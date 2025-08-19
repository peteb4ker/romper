import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";
import { FiCheck, FiEdit2, FiX } from "react-icons/fi";

export interface UseVoicePanelUIOptions {
  isEditable: boolean;
  voice: number;
  voiceName: null | string;
  voiceNameEditorHook: {
    editing: boolean;
    editValue: string;
    handleCancel: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleSave: () => void;
    setEditValue: (value: string) => void;
    startEditing: () => void;
  };
}

/**
 * Hook for rendering voice panel UI elements (voice name)
 * Extracted from useVoicePanelRendering to reduce complexity
 */
export function useVoicePanelUI({
  isEditable,
  voice,
  voiceName,
  voiceNameEditorHook,
}: UseVoicePanelUIOptions) {
  // Render voice name section
  const renderVoiceName = React.useCallback(
    (dataTestIdVoiceName?: string) => (
      <div className="font-semibold mb-1 text-gray-800 dark:text-gray-100 pl-1 flex items-center gap-2">
        <span>{voice}:</span>
        {voiceNameEditorHook.editing ? (
          <>
            <input
              autoFocus
              className="ml-1 px-2 py-0.5 rounded border border-blue-400 text-sm font-semibold bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-100 w-32"
              onChange={(e) => voiceNameEditorHook.setEditValue(e.target.value)}
              onKeyDown={voiceNameEditorHook.handleKeyDown}
              value={voiceNameEditorHook.editValue}
            />
            <button
              className="ml-1 text-green-600 dark:text-green-400"
              onClick={voiceNameEditorHook.handleSave}
              title="Save"
            >
              <FiCheck />
            </button>
            <button
              className="ml-1 text-red-600 dark:text-red-400"
              onClick={voiceNameEditorHook.handleCancel}
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
                onClick={voiceNameEditorHook.startEditing}
                title="Edit voice name"
              >
                <FiEdit2 />
              </button>
            )}
          </>
        )}
      </div>
    ),
    [voice, voiceNameEditorHook, voiceName, isEditable],
  );

  return {
    renderVoiceName,
  };
}

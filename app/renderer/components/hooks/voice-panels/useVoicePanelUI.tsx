import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

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
      <div className="font-semibold mb-1 text-text-primary pl-1 flex items-center gap-2">
        <span>{voice}:</span>
        {voiceNameEditorHook.editing ? (
          <>
            <input
              autoFocus
              className="ml-1 px-2 py-0.5 rounded border border-accent-primary text-sm font-semibold bg-surface-2 text-text-primary w-32"
              onChange={(e) => voiceNameEditorHook.setEditValue(e.target.value)}
              onKeyDown={voiceNameEditorHook.handleKeyDown}
              value={voiceNameEditorHook.editValue}
            />
            <button
              className="ml-1 text-accent-success"
              onClick={voiceNameEditorHook.handleSave}
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              className="ml-1 text-accent-danger"
              onClick={voiceNameEditorHook.handleCancel}
              title="Cancel"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <span
              className={
                voiceName
                  ? "ml-1 px-2 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary text-sm font-semibold tracking-wide"
                  : "ml-1 px-2 py-0.5 rounded-full bg-surface-3 text-text-tertiary text-sm font-semibold tracking-wide italic"
              }
              data-testid={dataTestIdVoiceName || `voice-name-${voice}`}
            >
              {voiceName ? toCapitalCase(voiceName) : "No voice name set"}
            </span>
            {isEditable && (
              <button
                className="ml-1 text-accent-primary"
                onClick={voiceNameEditorHook.startEditing}
                title="Edit voice name"
              >
                <PencilSimple size={16} />
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

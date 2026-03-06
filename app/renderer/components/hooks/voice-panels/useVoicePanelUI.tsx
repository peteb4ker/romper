import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

import StereoIcon from "../../icons/StereoIcon";

export interface UseVoicePanelUIOptions {
  isEditable: boolean;
  isLinkedPrimary?: boolean;
  linkedWith?: number;
  onVoiceUnlink?: (primaryVoice: number) => void;
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
  isLinkedPrimary,
  linkedWith,
  onVoiceUnlink,
  voice,
  voiceName,
  voiceNameEditorHook,
}: UseVoicePanelUIOptions) {
  // Render voice name section
  const renderVoiceName = React.useCallback(
    (dataTestIdVoiceName?: string) => (
      <div className="font-semibold mb-1 text-text-primary pl-1 flex items-center gap-2">
        <span>
          {isLinkedPrimary && linkedWith ? `${voice}+${linkedWith}` : voice}
        </span>
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
                  ? "text-sm text-text-secondary font-medium tracking-wide"
                  : "text-sm text-text-tertiary italic"
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
        {/* Stereo badge — always visible regardless of editing state */}
        {isLinkedPrimary && <span className="flex-1" />}
        {isLinkedPrimary && (
          <button
            className="flex items-center gap-1 text-xs text-text-secondary opacity-80 hover:opacity-100 transition-opacity flex-shrink-0"
            data-testid={`stereo-badge-${voice}`}
            onClick={() => onVoiceUnlink?.(voice)}
            title="Click to unlink stereo channels"
            type="button"
          >
            Stereo
            <StereoIcon size={18} />
          </button>
        )}
      </div>
    ),
    [
      voice,
      voiceNameEditorHook,
      voiceName,
      isEditable,
      isLinkedPrimary,
      linkedWith,
      onVoiceUnlink,
    ],
  );

  return {
    renderVoiceName,
  };
}

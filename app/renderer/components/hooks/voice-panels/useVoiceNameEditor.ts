import { useCallback, useEffect, useState } from "react";

export interface UseVoiceNameEditorOptions {
  onSaveVoiceName: (voice: number, newName: string) => void;
  voice: number;
  voiceName: null | string;
}

/**
 * Hook for managing voice name editing state and handlers
 * Extracted from KitVoicePanel to reduce component complexity
 */
export function useVoiceNameEditor({
  onSaveVoiceName,
  voice,
  voiceName,
}: UseVoiceNameEditorOptions) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(voiceName || "");

  // Update edit value when voice name changes externally
  useEffect(() => {
    setEditValue(voiceName || "");
  }, [voiceName]);

  const handleSave = useCallback(() => {
    onSaveVoiceName(voice, editValue.trim());
    setEditing(false);
  }, [onSaveVoiceName, voice, editValue]);

  const handleCancel = useCallback(() => {
    setEditValue(voiceName || "");
    setEditing(false);
  }, [voiceName]);

  const startEditing = useCallback(() => {
    setEditing(true);
  }, []);

  const setEditValueWrapper = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  return {
    editing,
    editValue,
    handleCancel,
    handleKeyDown,
    handleSave,
    setEditValue: setEditValueWrapper,
    startEditing,
  };
}

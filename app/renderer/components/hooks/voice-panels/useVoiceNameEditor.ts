import { useCallback, useState } from "react";

export interface UseVoiceNameEditorOptions {
  // Resolves to false when the name wasn't saved (RE-91)
  onSaveVoiceName: (voice: number, newName: string) => Promise<boolean> | void;
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
  const [shownName, setShownName] = useState(voiceName);
  if (shownName !== voiceName) {
    setShownName(voiceName);
    setEditValue(voiceName || "");
  }

  const handleSave = useCallback(() => {
    const saved = onSaveVoiceName(voice, editValue.trim());
    setEditing(false);
    // A name that wasn't saved isn't kept for the next edit (RE-91)
    void Promise.resolve(saved).then((ok) => {
      if (ok === false) setEditValue(voiceName || "");
    });
  }, [onSaveVoiceName, voice, editValue, voiceName]);

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
    [handleSave, handleCancel],
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

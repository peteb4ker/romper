import { useCallback } from "react";

export interface UseVoiceAliasParams {
  kitName: string;
  onUpdate?: () => void;
}

/**
 * Hook for managing voice aliases
 */
export function useVoiceAlias({ kitName, onUpdate }: UseVoiceAliasParams) {
  const updateVoiceAlias = useCallback(
    async (voiceNumber: number, voiceAlias: string) => {
      if (!window.electronAPI?.updateVoiceAlias || !kitName) return;

      try {
        const result = await window.electronAPI.updateVoiceAlias(
          kitName,
          voiceNumber,
          voiceAlias,
        );
        if (result.success) {
          onUpdate?.();
        } else {
          console.error("Failed to update voice alias:", result.error);
        }
      } catch (e) {
        console.error("Failed to update voice alias:", e);
      }
    },
    [kitName, onUpdate],
  );

  return {
    updateVoiceAlias,
  };
}

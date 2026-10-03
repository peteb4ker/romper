import { useCallback } from "react";

import { saveFailed } from "../shared/useSettingSave";

export interface UseVoiceAliasParams {
  kitName: string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onUpdate?: () => void;
}

/**
 * Hook for managing voice aliases
 */
export function useVoiceAlias({
  kitName,
  onMessage,
  onUpdate,
}: UseVoiceAliasParams) {
  // Resolves to whether the name was saved. The voice keeps its old name
  // on screen until the kit reloads, so a failed save leaves it there and
  // says so (RE-91).
  const updateVoiceAlias = useCallback(
    async (voiceNumber: number, voiceAlias: string): Promise<boolean> => {
      if (!globalThis.electronAPI?.updateVoiceAlias || !kitName) return false;

      const failed = await saveFailed(
        globalThis.electronAPI.updateVoiceAlias(
          kitName,
          voiceNumber,
          voiceAlias,
        ),
        `the name for voice ${voiceNumber}`,
      );
      if (failed) {
        onMessage?.(
          `Couldn't save the name for voice ${voiceNumber}. Try again.`,
          "error",
        );
        return false;
      }
      onUpdate?.();
      return true;
    },
    [kitName, onMessage, onUpdate],
  );

  return {
    updateVoiceAlias,
  };
}

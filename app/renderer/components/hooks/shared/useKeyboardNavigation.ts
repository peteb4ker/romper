import { useCallback } from "react";

export interface UseKeyboardNavigationOptions {
  isActive: boolean;
  onPlay: (voice: number, sample: string) => void;
  samples: string[];
  selectedIdx: number;
  voice: number;
}

/**
 * Hook for managing keyboard navigation within voice panel sample slots
 * Extracted from KitVoicePanel to reduce component complexity
 */
export function useKeyboardNavigation({
  isActive,
  onPlay,
  samples,
  selectedIdx,
  voice,
}: UseKeyboardNavigationOptions) {
  // Only handle Space for play when focused, not up/down navigation
  // Enter key removed to prevent conflicts with kit name editing
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (!samples.length) return;
      if (!isActive) return;
      if (e.key === " ") {
        e.preventDefault();
        const sample = samples[selectedIdx];
        onPlay(voice, sample);
      }
    },
    [samples, isActive, selectedIdx, voice, onPlay]
  );

  return {
    handleKeyDown,
  };
}

import { useState } from 'react';

/**
 * Hook for full kit preview playback using built-in MIDI test patterns.
 * Handles play/stop state and triggers for the entire kit.
 */
export function useKitPreview(kitName: string, kitVoices: Record<number, string[]>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Play the full kit using a MIDI test pattern
  const handlePlayKit = () => {
    setIsPlaying(true);
    setError(null);
    // @ts-ignore
    window.electronAPI?.playKitPreview?.({ kitName, kitVoices });
  };

  // Stop the full kit preview
  const handleStopKit = () => {
    setIsPlaying(false);
    // @ts-ignore
    window.electronAPI?.stopKitPreview?.();
  };

  // Listen for playback end/error events (optional: could use useEffect for real events)

  return {
    isPlaying,
    error,
    handlePlayKit,
    handleStopKit,
    setError,
  };
}

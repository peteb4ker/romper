import { useCallback,useState } from 'react';

// 4 voices, 16 steps per voice
export const NUM_VOICES = 4;
export const NUM_STEPS = 16;

export function useKitStepSequencer(initialPattern?: boolean[][]) {
  // pattern[voice][step] = boolean
  const [pattern, setPattern] = useState<boolean[][]>(
    initialPattern || Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(false))
  );

  // Toggle a step on/off
  const toggleStep = useCallback((voiceIdx: number, stepIdx: number) => {
    setPattern(prev => prev.map((row, v) =>
      v === voiceIdx ? row.map((on, s) => (s === stepIdx ? !on : on)) : row
    ));
  }, []);

  // Set the entire pattern (for loading/saving)
  const setSequencerPattern = useCallback((newPattern: boolean[][]) => {
    setPattern(newPattern);
  }, []);

  return {
    pattern,
    toggleStep,
    setSequencerPattern,
    NUM_VOICES,
    NUM_STEPS,
  };
}

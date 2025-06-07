import { useCallback,useState } from 'react';

export function useStepSequencerFocus(numVoices: number, numSteps: number) {
  const [focusedStep, setFocusedStep] = useState<{ voice: number; step: number }>({ voice: 0, step: 0 });

  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setFocusedStep(({ voice, step }) => {
      let nextVoice = voice;
      let nextStep = step;
      if (direction === 'right') nextStep = (step + 1) % numSteps;
      else if (direction === 'left') nextStep = (step - 1 + numSteps) % numSteps;
      else if (direction === 'down') nextVoice = (voice + 1) % numVoices;
      else if (direction === 'up') nextVoice = (voice - 1 + numVoices) % numVoices;
      return { voice: nextVoice, step: nextStep };
    });
  }, [numVoices, numSteps]);

  return { focusedStep, setFocusedStep, moveFocus };
}

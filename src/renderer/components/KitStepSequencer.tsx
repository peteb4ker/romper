import React from 'react';
import { FiPlay, FiSquare } from 'react-icons/fi';

import { NUM_STEPS,NUM_VOICES } from './hooks/useKitStepSequencer';
import { useStepSequencerFocus } from './hooks/useStepSequencerFocus';

// @ts-ignore
const workerUrl = new URL('./kitStepSequencerWorker.ts', import.meta.url,);

interface KitStepSequencerProps {
  samples: { [voice: number]: string[] };
  onPlaySample: (voice: number, sample: string) => void;
  stepPattern: boolean[][] | null;
  setStepPattern: (pattern: boolean[][]) => void;
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = ({
  samples,
  onPlaySample,
  stepPattern,
  setStepPattern,
}) => {
  const { focusedStep, setFocusedStep, moveFocus } = useStepSequencerFocus(NUM_VOICES, NUM_STEPS);
  const [drawerOpen, setDrawerOpen] = React.useState(true);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [isSeqPlaying, setIsSeqPlaying] = React.useState(false);
  const [currentSeqStep, setCurrentSeqStep] = React.useState<number>(0);

  // Memoize worker instance
  const workerRef = React.useRef<Worker | null>(null);
  const worker = React.useMemo(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: 'module' });
    }
    return workerRef.current;
  }, []);

  React.useEffect(() => {
    if (!worker) return;
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'STEP') {
        setCurrentSeqStep(e.data.payload.currentStep);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [worker]);

  // Start/stop worker on play/stop
  React.useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (isSeqPlaying) {
      worker.postMessage({ type: 'START', payload: { numSteps: NUM_STEPS, stepDuration: 125 } });
    } else {
      worker.postMessage({ type: 'STOP' });
    }
  }, [isSeqPlaying]);

  // Track last played step to avoid retriggering on same step
  const lastStepRef = React.useRef<number | null>(null);

  // Trigger sample playback for each active step on step advance
  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change
    lastStepRef.current = currentSeqStep;
    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const isStepActive = stepPattern[voiceIdx][currentSeqStep];
      const sample = samples[voiceIdx + 1]?.[0];
      if (isStepActive && sample) {
        onPlaySample(voiceIdx + 1, sample);
      }
    }
  }, [isSeqPlaying, currentSeqStep, stepPattern, samples, onPlaySample]);

  // Step sequencer keyboard navigation handler
  const handleStepGridKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!drawerOpen) return;
    const { voice, step } = focusedStep;
    if (e.key === 'ArrowRight') moveFocus('right');
    else if (e.key === 'ArrowLeft') moveFocus('left');
    else if (e.key === 'ArrowDown') moveFocus('down');
    else if (e.key === 'ArrowUp') moveFocus('up');
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleStep(voice, step);
      return;
    } else {
      return;
    }
    e.preventDefault();
  }, [drawerOpen, focusedStep, moveFocus, setStepPattern, stepPattern]);

  // Toggle step helper
  const toggleStep = React.useCallback((voiceIdx: number, stepIdx: number) => {
    if (!stepPattern) return;
    const newPattern = stepPattern.map((row, v) =>
      v === voiceIdx ? row.map((on, s) => (s === stepIdx ? !on : on)) : row
    );
    setStepPattern(newPattern);
  }, [stepPattern, setStepPattern]);

  const [localStepPattern, setLocalStepPattern] = React.useState<boolean[][] | null>(null);

  // Defensive: ensure stepPattern is always a valid 4x16 boolean array
  const safeStepPattern = React.useMemo(() => {
    if (
      !stepPattern ||
      !Array.isArray(stepPattern) ||
      stepPattern.length !== NUM_VOICES ||
      stepPattern.some(row => !Array.isArray(row) || row.length !== NUM_STEPS)
    ) {
      return Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(false));
    }
    return stepPattern;
  }, [stepPattern]);

  return (
    <div className="relative w-full flex flex-col items-center" style={{ zIndex: 19, minHeight: '33px' }}>
      {/* Drawer handle/edge */}
      <button
        className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-36 h-6 border-b-0 rounded-t-sm bg-gray-300 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 shadow-md hover:bg-gray-400 dark:hover:bg-slate-600 transition-colors focus:outline-none pointer-events-auto ${drawerOpen ? '-top-4' : 'top-2'}`}
        style={{ cursor: 'pointer', transition: 'top 0.4s cubic-bezier(0.4,0,0.2,1)' }}
        aria-label={drawerOpen ? 'Hide step sequencer' : 'Show step sequencer'}
        data-testid="kit-step-sequencer-handle"
        onClick={() => setDrawerOpen(v => !v)}
      >
        <span className="w-6 h-1 rounded bg-gray-500 dark:bg-gray-300 block" />
        <span className="ml-2 text-xs font-semibold">{drawerOpen ? 'Hide' : 'Show'} Sequencer</span>
      </button>
      {/* Drawer body with animation */}
      <div
        className={`transition-all duration-500 ease-in-out rounded-t-md overflow-hidden w-full flex justify-center pointer-events-auto ${drawerOpen ? 'max-h-[400px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 translate-y-8 pointer-events-none'}`}
        style={{
          boxShadow: drawerOpen ? '0 -4px 24px 0 rgba(0,0,0,0.18)' : undefined,
          background: 'linear-gradient(180deg, #23272f 0%, #181a20 100%)',
          borderTop: '2px solid #8884',
          marginTop: drawerOpen ? 8 : 0,
          position: 'relative',
        }}
        data-testid="kit-step-sequencer-drawer"
      >
        <div className="mt-4 mb-4" data-testid="kit-step-sequencer">
          {/* Step sequencer controls */}
          <div className="flex items-center gap-3 mb-2 justify-center" data-testid="kit-step-sequencer-controls">
            <button
              type="button"
              className="rounded p-2 border border-gray-400 dark:border-gray-600 bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={isSeqPlaying ? 'Stop sequencer' : 'Play sequencer'}
              title={isSeqPlaying ? 'Stop sequencer' : 'Play sequencer'}
              onClick={() => setIsSeqPlaying(p => !p)}
              data-testid={isSeqPlaying ? 'stop-step-sequencer' : 'play-step-sequencer'}
            >
              {isSeqPlaying ? <FiSquare /> : <FiPlay />}
            </button>
            <span className="text-xs text-gray-300">120 BPM</span>
          </div>
          <div
            className="flex flex-col gap-2 w-[600px] min-w-[600px] max-w-[600px] mx-auto"
            data-testid="kit-step-sequencer-grid"
            tabIndex={drawerOpen ? 0 : -1}
            ref={gridRef}
            onKeyDown={handleStepGridKeyDown}
            aria-label="Step sequencer grid"
            style={{ outline: 'none' }}
          >
            {Array.from({ length: NUM_VOICES }).map((_, voiceIdx) => (
              <div key={`seq-row-${voiceIdx}`} className="flex items-center gap-1 justify-center">
                <span
                  className={`flex items-center justify-center w-8 text-center font-bold rounded w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 ${['bg-blue-900/60','bg-green-900/60','bg-yellow-900/60','bg-pink-900/60'][voiceIdx]} text-gray-200 border border-gray-900 dark:border-slate-900`}
                  data-testid={`seq-voice-label-${voiceIdx}`}
                >
                  {voiceIdx + 1}
                </span>
                {Array.from({ length: NUM_STEPS }).map((_, stepIdx) => (
                  <button
                    key={`seq-step-${voiceIdx}-${stepIdx}`}
                    type="button"
                    className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors
                      ${safeStepPattern[voiceIdx][stepIdx]
                        ? (
                            [
                              'bg-blue-500 border-blue-800',
                              'bg-green-500 border-green-800',
                              'bg-yellow-500 border-yellow-700',
                              'bg-pink-500 border-pink-800'
                            ][voiceIdx] +
                            ' shadow-[0_0_4px_2px_rgba(59,130,246,0.5)]'
                          )
                        : 'bg-gray-300 dark:bg-slate-700 border-gray-400 dark:border-slate-600'
                      }
                      ${isSeqPlaying && currentSeqStep === stepIdx ? ' ring-2 ring-cyan-400 z-30' : ''}`
                    }
                    style={safeStepPattern[voiceIdx][stepIdx] ? { boxShadow: `0 0 8px 2px ${['#3b82f6','#22c55e','#eab308','#ec4899'][voiceIdx]}, 0 0 2px 1px rgba(0,0,0,0.10)` } : {}}
                    aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceIdx + 1}`}
                    data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
                    onClick={() => {
                      setFocusedStep({ voice: voiceIdx, step: stepIdx });
                      toggleStep(voiceIdx, stepIdx);
                    }}
                  >
                    {/* LED/backlit highlight for enabled steps */}
                    {safeStepPattern[voiceIdx][stepIdx] && (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-md opacity-60"
                        style={{
                          background: [
                            'radial-gradient(circle, #3b82f6 60%, transparent 100%)',
                            'radial-gradient(circle, #22c55e 60%, transparent 100%)',
                            'radial-gradient(circle, #eab308 60%, transparent 100%)',
                            'radial-gradient(circle, #ec4899 60%, transparent 100%)',
                          ][voiceIdx],
                          zIndex: 10,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    {/* Step highlight for playback */}
                    {isSeqPlaying && currentSeqStep === stepIdx && (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-cyan-400 animate-pulse z-30"
                        aria-hidden="true"
                      />
                    )}
                    {/* Restore the blue focus ring as an inner span for keyboard navigation */}
                    {focusedStep.voice === voiceIdx && focusedStep.step === stepIdx && (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-blue-400 z-20"
                        aria-hidden="true"
                        data-testid="seq-step-focus-ring"
                      />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitStepSequencer;

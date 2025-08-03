import React from "react";
import { FiPlay, FiSquare } from "react-icons/fi";

interface StepSequencerControlsProps {
  isSeqPlaying: boolean;
  setIsSeqPlaying: (playing: boolean) => void;
}

const StepSequencerControls: React.FC<StepSequencerControlsProps> = ({
  isSeqPlaying,
  setIsSeqPlaying,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-start pt-2"
      data-testid="kit-step-sequencer-controls"
    >
      <button
        aria-label={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
        className="rounded p-2 border border-gray-400 dark:border-gray-600 bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        data-testid={
          isSeqPlaying ? "stop-step-sequencer" : "play-step-sequencer"
        }
        onClick={() => setIsSeqPlaying(!isSeqPlaying)}
        title={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
        type="button"
      >
        {isSeqPlaying ? <FiSquare /> : <FiPlay />}
      </button>
      <span className="text-xs text-gray-300">120 BPM</span>
    </div>
  );
};

export default StepSequencerControls;

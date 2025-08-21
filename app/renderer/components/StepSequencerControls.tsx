import React from "react";
import { FiPlay, FiSquare } from "react-icons/fi";

interface BpmLogic {
  bpm: number;
  isEditing: boolean;
  setBpm: (bpm: number) => void;
  setIsEditing: (editing: boolean) => void;
  validateBpm: (bpm: number) => boolean;
}

interface StepSequencerControlsProps {
  bpmLogic: BpmLogic;
  isSeqPlaying: boolean;
  kitName: string;
  setIsSeqPlaying: (playing: boolean) => void;
}

const StepSequencerControls: React.FC<StepSequencerControlsProps> = ({
  bpmLogic,
  isSeqPlaying,
  kitName: _kitName,
  setIsSeqPlaying,
}) => {
  const [inputValue, setInputValue] = React.useState(bpmLogic.bpm.toString());

  React.useEffect(() => {
    setInputValue(bpmLogic.bpm.toString());
  }, [bpmLogic.bpm]);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Update BPM immediately if valid
    const newBpm = parseInt(newValue, 10);
    if (bpmLogic.validateBpm(newBpm)) {
      bpmLogic.setBpm(newBpm);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentBpm = bpmLogic.bpm;
      const newBpm = e.key === "ArrowUp" ? currentBpm + 1 : currentBpm - 1;

      if (bpmLogic.validateBpm(newBpm)) {
        bpmLogic.setBpm(newBpm);
      }
    }
  };
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

      <div className="flex flex-col items-center">
        <div className="flex items-center gap-1">
          <input
            className="text-xs text-center w-12 px-1 py-0.5 border border-gray-400 dark:border-gray-600 rounded bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid="bpm-input"
            max={180}
            min={30}
            onChange={handleBpmChange}
            onKeyDown={handleKeyDown}
            type="number"
            value={inputValue}
          />
          <span className="text-xs text-gray-300">BPM</span>
        </div>
        <span className="text-xs text-gray-500 mt-0.5">30-180</span>
      </div>
    </div>
  );
};

export default StepSequencerControls;

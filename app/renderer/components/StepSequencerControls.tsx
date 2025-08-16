import React from "react";
import { FiPlay, FiSquare } from "react-icons/fi";

interface StepSequencerControlsProps {
  bpm: number;
  isSeqPlaying: boolean;
  setBpm: (bpm: number) => void;
  setIsSeqPlaying: (playing: boolean) => void;
}

const StepSequencerControls: React.FC<StepSequencerControlsProps> = ({
  bpm,
  isSeqPlaying,
  setBpm,
  setIsSeqPlaying,
}) => {
  const [editingBpm, setEditingBpm] = React.useState(false);
  const [bpmInput, setBpmInput] = React.useState((bpm || 120).toString());
  const bpmInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setBpmInput((bpm || 120).toString());
  }, [bpm]);

  const handleSaveBpm = (value: string) => {
    const numValue = parseInt(value, 10);
    if (numValue >= 30 && numValue <= 180) {
      setBpm(numValue);
    } else {
      setBpmInput((bpm || 120).toString()); // Reset to current valid value
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
      {editingBpm ? (
        <input
          autoFocus
          className="border-b border-blue-500 bg-transparent text-xs text-center text-gray-800 dark:text-gray-100 focus:outline-none px-1 w-16"
          max="180"
          min="30"
          onBlur={() => {
            setEditingBpm(false);
            handleSaveBpm(bpmInput);
          }}
          onChange={(e) => setBpmInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditingBpm(false);
              handleSaveBpm(bpmInput);
            } else if (e.key === "Escape") {
              setEditingBpm(false);
              setBpmInput(bpm.toString());
            }
          }}
          ref={bpmInputRef}
          type="number"
          value={bpmInput}
        />
      ) : (
        <button
          className="text-xs text-gray-300 hover:text-blue-400 dark:hover:text-blue-300 cursor-pointer bg-transparent border-none p-0"
          onClick={() => setEditingBpm(true)}
          title="Click to edit BPM (30-180)"
          type="button"
        >
          {bpm || 120} BPM
        </button>
      )}
    </div>
  );
};

export default StepSequencerControls;

import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import React from "react";

interface BpmLogic {
  bpm: number;
  isEditing: boolean;
  setBpm: (bpm: number) => void;
  setIsEditing: (editing: boolean) => void;
  validateBpm: (bpm: number) => boolean;
}

interface StepSequencerControlsProps {
  bpmLogic: BpmLogic;
  cycleCount?: number;
  isSeqPlaying: boolean;
  kitName: string;
  setIsSeqPlaying: (playing: boolean) => void;
}

/**
 * Transport column: Play/Stop + BPM input.
 * Rendered as a vertical column to the left of the step grid.
 */
const StepSequencerControls: React.FC<StepSequencerControlsProps> = ({
  bpmLogic,
  cycleCount = 0,
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

    const newBpm = Number.parseInt(newValue, 10);
    if (bpmLogic.validateBpm(newBpm)) {
      bpmLogic.setBpm(newBpm);
    }
  };

  const handleBpmKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      className="flex flex-col items-center justify-start gap-2 px-3 self-stretch"
      data-testid="kit-step-sequencer-controls"
    >
      <button
        aria-label={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
        className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-accent-primary transition-all ${
          isSeqPlaying
            ? "bg-transport-play/30 border-transport-play text-transport-play shadow-[0_0_10px_rgba(217,119,6,0.4)]"
            : "bg-surface-2 border-border-default hover:bg-surface-3 text-text-primary"
        }`}
        data-testid={
          isSeqPlaying ? "stop-step-sequencer" : "play-step-sequencer"
        }
        onClick={() => setIsSeqPlaying(!isSeqPlaying)}
        title={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
        type="button"
      >
        {isSeqPlaying ? (
          <StopIcon size={20} weight="fill" />
        ) : (
          <PlayIcon size={20} weight="fill" />
        )}
      </button>

      <div className="flex flex-col items-center">
        <input
          className="text-xs text-center w-12 px-1 py-1 border border-border-default rounded-md bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent-primary"
          data-testid="bpm-input"
          max={180}
          min={30}
          onChange={handleBpmChange}
          onKeyDown={handleBpmKeyDown}
          type="number"
          value={inputValue}
        />
        <span className="text-[10px] text-text-tertiary mt-0.5">BPM</span>
      </div>

      {/* Cycle counter — visible during playback */}
      {isSeqPlaying && (
        <span
          className="text-[10px] text-text-tertiary whitespace-nowrap"
          data-testid="cycle-counter"
        >
          <span className="font-mono font-bold text-text-primary tabular-nums">
            {cycleCount + 1}
          </span>
          {" cycle"}
        </span>
      )}
    </div>
  );
};

export default StepSequencerControls;

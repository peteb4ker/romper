import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import React from "react";

import { SequencerKeysButton } from "./SequencerHelp";
import { TRANSPORT_WIDTH } from "./sequencerLayout";

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
  /** Opens the keyboard shortcut list. */
  onShowKeys?: () => void;
  setIsSeqPlaying: (playing: boolean) => void;
}

/** Loops shown by the loop indicator: the longest trigger condition cycle. */
const LOOP_PIPS = 4;

/**
 * Transport column: Play/Stop, BPM, and which of the four loops is
 * playing (what A:B trigger conditions count).
 */
const StepSequencerControls: React.FC<StepSequencerControlsProps> = ({
  bpmLogic,
  cycleCount = 0,
  isSeqPlaying,
  kitName: _kitName,
  onShowKeys,
  setIsSeqPlaying,
}) => {
  const [inputValue, setInputValue] = React.useState(bpmLogic.bpm.toString());
  const bpmRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setInputValue(bpmLogic.bpm.toString());
  }, [bpmLogic.bpm]);

  const nudgeBpm = React.useCallback(
    (delta: number) => {
      const next = bpmLogic.bpm + delta;
      if (bpmLogic.validateBpm(next)) bpmLogic.setBpm(next);
    },
    [bpmLogic],
  );

  // Scroll over the BPM to change it (Shift: by 10), like a hardware encoder.
  // A native non-passive listener so the page doesn't scroll meanwhile.
  React.useEffect(() => {
    const el = bpmRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const delta = e.deltaY || e.deltaX;
      if (!delta) return;
      e.preventDefault();
      nudgeBpm((delta < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [nudgeBpm]);

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
      nudgeBpm((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1));
    }
  };

  const loop = cycleCount % LOOP_PIPS;

  return (
    <div
      className="flex flex-col items-center justify-start gap-2.5 shrink-0"
      data-testid="kit-step-sequencer-controls"
      style={{ width: TRANSPORT_WIDTH }}
    >
      <button
        aria-label={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
        className={`flex items-center justify-center w-14 h-14 rounded-xl border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary transition-all ${
          isSeqPlaying
            ? "bg-transport-play/25 border-transport-play text-transport-play shadow-[0_0_14px_-2px_var(--transport-play)]"
            : "bg-surface-2 border-border-default hover:bg-surface-3 text-text-primary"
        }`}
        data-testid={
          isSeqPlaying ? "stop-step-sequencer" : "play-step-sequencer"
        }
        onClick={() => setIsSeqPlaying(!isSeqPlaying)}
        title={isSeqPlaying ? "Stop (Space)" : "Play (Space)"}
        type="button"
      >
        {isSeqPlaying ? (
          <StopIcon size={24} weight="fill" />
        ) : (
          <PlayIcon size={24} weight="fill" />
        )}
      </button>

      <label className="flex flex-col items-center">
        <input
          className="text-base font-semibold text-center w-16 px-1 py-1 border border-border-default rounded-md bg-surface-2 tabular-nums cursor-ns-resize focus:cursor-text focus:outline-none focus:ring-2 focus:ring-accent-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          data-testid="bpm-input"
          max={180}
          min={30}
          onChange={handleBpmChange}
          onKeyDown={handleBpmKeyDown}
          ref={bpmRef}
          title="Tempo, 30–180 BPM. Scroll or use the arrow keys to change it (Shift: by 10)."
          type="number"
          value={inputValue}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mt-1">
          BPM
        </span>
      </label>

      {/* Which loop of four is playing; A:B conditions count these */}
      <div
        aria-label={
          isSeqPlaying
            ? `Loop ${loop + 1} of ${LOOP_PIPS}`
            : `Loop counter, ${LOOP_PIPS} loops`
        }
        className="flex flex-col items-center"
        data-testid="cycle-counter"
        role="status"
        title="Trigger conditions like 2:4 play on one loop of every 2 or 4"
      >
        <span className="flex gap-1">
          {Array.from({ length: LOOP_PIPS }, (_, i) => {
            const lit = isSeqPlaying && i === loop;
            return (
              <span
                className={`block w-2 h-2 rounded-full ${lit ? "bg-transport-play" : "bg-border-default"}`}
                data-lit={lit || undefined}
                data-testid={`loop-pip-${i}`}
                key={i}
              />
            );
          })}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary mt-1">
          Loop
        </span>
      </div>

      {onShowKeys && (
        <div className="mt-1">
          <SequencerKeysButton onClick={onShowKeys} />
        </div>
      )}
    </div>
  );
};

export default StepSequencerControls;

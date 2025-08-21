import React from "react";

import { useKitStepSequencerLogic } from "./hooks/kit-management/useKitStepSequencerLogic";
import { useBpm } from "./hooks/shared/useBpm";
import StepSequencerControls from "./StepSequencerControls";
import StepSequencerDrawer from "./StepSequencerDrawer";
import StepSequencerGrid from "./StepSequencerGrid";

interface KitStepSequencerProps {
  bpm?: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName: string;
  onPlaySample: (voice: number, sample: string) => void;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void; // Used by useKitStepSequencerLogic hook
  stepPattern: null | number[][]; // Used by useKitStepSequencerLogic hook
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = (props) => {
  // Manage BPM state at this level to ensure sequencer logic gets live updates
  const bpmLogic = useBpm({ initialBpm: props.bpm, kitName: props.kitName });

  // Pass the current BPM from bpmLogic to sequencer logic for live updates
  const logic = useKitStepSequencerLogic({
    ...props,
    bpm: bpmLogic.bpm, // Use live BPM value instead of initial prop
  });

  return (
    <StepSequencerDrawer
      sequencerOpen={props.sequencerOpen}
      setSequencerOpen={props.setSequencerOpen}
    >
      <div className="flex flex-row items-start justify-center gap-4">
        <StepSequencerControls
          bpmLogic={bpmLogic}
          isSeqPlaying={logic.isSeqPlaying}
          kitName={props.kitName}
          setIsSeqPlaying={logic.setIsSeqPlaying}
        />
        <StepSequencerGrid
          currentSeqStep={logic.currentSeqStep}
          focusedStep={logic.focusedStep}
          gridRef={props.gridRef || logic.gridRefInternal}
          handleStepGridKeyDown={logic.handleStepGridKeyDown}
          isSeqPlaying={logic.isSeqPlaying}
          LED_GLOWS={logic.LED_GLOWS}
          NUM_STEPS={logic.NUM_STEPS}
          NUM_VOICES={logic.NUM_VOICES}
          ROW_COLORS={logic.ROW_COLORS}
          safeStepPattern={logic.safeStepPattern}
          setFocusedStep={logic.setFocusedStep}
          toggleStep={logic.toggleStep}
        />
      </div>
    </StepSequencerDrawer>
  );
};

export default KitStepSequencer;

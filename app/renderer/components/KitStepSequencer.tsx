import React from "react";

import { useKitStepSequencerLogic } from "./hooks/kit-management/useKitStepSequencerLogic";
import StepSequencerControls from "./StepSequencerControls";
import StepSequencerDrawer from "./StepSequencerDrawer";
import StepSequencerGrid from "./StepSequencerGrid";

interface KitStepSequencerProps {
  bpm: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  onPlaySample: (voice: number, sample: string) => void;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setBpm: (bpm: number) => void;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void; // Used by useKitStepSequencerLogic hook
  stepPattern: null | number[][]; // Used by useKitStepSequencerLogic hook
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = (props) => {
  const logic = useKitStepSequencerLogic(props);

  return (
    <StepSequencerDrawer
      sequencerOpen={props.sequencerOpen}
      setSequencerOpen={props.setSequencerOpen}
    >
      <div className="flex flex-row items-start justify-center gap-4">
        <StepSequencerControls
          bpm={props.bpm}
          isSeqPlaying={logic.isSeqPlaying}
          setBpm={props.setBpm}
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

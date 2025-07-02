import React from "react";

import { useKitStepSequencerLogic } from "./hooks/useKitStepSequencerLogic";
import StepSequencerControls from "./StepSequencerControls";
import StepSequencerDrawer from "./StepSequencerDrawer";
import StepSequencerGrid from "./StepSequencerGrid";

interface KitStepSequencerProps {
  samples: { [voice: number]: string[] };
  onPlaySample: (voice: number, sample: string) => void;
  stepPattern: number[][] | null;
  setStepPattern: (pattern: number[][]) => void;
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  gridRef?: React.RefObject<HTMLDivElement>;
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
          isSeqPlaying={logic.isSeqPlaying}
          setIsSeqPlaying={logic.setIsSeqPlaying}
        />
        <StepSequencerGrid
          safeStepPattern={logic.safeStepPattern}
          focusedStep={logic.focusedStep}
          isSeqPlaying={logic.isSeqPlaying}
          currentSeqStep={logic.currentSeqStep}
          ROW_COLORS={logic.ROW_COLORS}
          LED_GLOWS={logic.LED_GLOWS}
          NUM_VOICES={logic.NUM_VOICES}
          NUM_STEPS={logic.NUM_STEPS}
          setFocusedStep={logic.setFocusedStep}
          toggleStep={logic.toggleStep}
          handleStepGridKeyDown={logic.handleStepGridKeyDown}
          gridRef={props.gridRef || logic.gridRefInternal}
        />
      </div>
    </StepSequencerDrawer>
  );
};

export default KitStepSequencer;

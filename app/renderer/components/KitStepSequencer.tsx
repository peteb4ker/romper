import React from "react";

import type { SampleMode } from "./hooks/shared/stepPatternConstants";

import { useKitStepSequencerLogic } from "./hooks/kit-management/useKitStepSequencerLogic";
import {
  NUM_VOICES,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";
import { useBpm } from "./hooks/shared/useBpm";
import StepSequencerControls from "./StepSequencerControls";
import StepSequencerDrawer from "./StepSequencerDrawer";
import StepSequencerGrid from "./StepSequencerGrid";

export interface StereoLinks {
  linkedSecondaries: Set<number>;
  primaryLabels: Record<number, string>;
}

interface KitStepSequencerProps {
  bpm?: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName: string;
  onPlaySample: (voice: number, sample: string, volume?: number) => void;
  onVoiceSettingChanged?: () => void;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void;
  setTriggerConditions: (conditions: (null | string)[][]) => void;
  stepPattern: null | number[][];
  triggerConditions: (null | string)[][];
  voices?: VoiceData[];
}

interface VoiceData {
  sample_mode?: string;
  stereo_mode?: boolean;
  voice_number: number;
  voice_volume?: number;
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = (props) => {
  // Manage BPM state at this level to ensure sequencer logic gets live updates
  const bpmLogic = useBpm({ initialBpm: props.bpm, kitName: props.kitName });

  // Voice mute state — session only, not persisted
  const [voiceMutes, setVoiceMutes] = React.useState<Record<number, boolean>>(
    () => {
      const mutes: Record<number, boolean> = {};
      for (let i = 1; i <= NUM_VOICES; i++) {
        mutes[i] = false;
      }
      return mutes;
    },
  );

  const handleMuteToggle = React.useCallback((voiceNumber: number) => {
    setVoiceMutes((prev) => ({ ...prev, [voiceNumber]: !prev[voiceNumber] }));
  }, []);

  // Voice volume state — initialized from voice data, managed locally
  const [voiceVolumes, setVoiceVolumes] = React.useState<
    Record<number, number>
  >(() => {
    const volumes: Record<number, number> = {};
    for (let i = 1; i <= NUM_VOICES; i++) {
      volumes[i] = 100;
    }
    return volumes;
  });

  // Sample mode state — initialized from voice data, managed locally
  const [sampleModes, setSampleModes] = React.useState<
    Record<number, SampleMode>
  >(() => {
    const modes: Record<number, SampleMode> = {};
    for (let i = 1; i <= NUM_VOICES; i++) {
      modes[i] = "first";
    }
    return modes;
  });

  // Sync state from voice data when it arrives/changes
  React.useEffect(() => {
    if (!props.voices?.length) return;
    const newVolumes: Record<number, number> = {};
    const newModes: Record<number, SampleMode> = {};
    for (const voice of props.voices) {
      newVolumes[voice.voice_number] = voice.voice_volume ?? 100;
      newModes[voice.voice_number] =
        (voice.sample_mode as SampleMode) || "first";
    }
    setVoiceVolumes(newVolumes);
    setSampleModes(newModes);
  }, [props.voices]);

  // Debounce kit cache refresh for volume slider drags
  const refreshTimerRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );
  const debouncedRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      props.onVoiceSettingChanged?.();
    }, 500);
  }, [props.onVoiceSettingChanged]);

  // Handle volume change — update local state + persist via IPC
  const handleVolumeChange = React.useCallback(
    (voiceNumber: number, volume: number) => {
      setVoiceVolumes((prev) => ({ ...prev, [voiceNumber]: volume }));
      window.electronAPI?.updateVoiceVolume?.(
        props.kitName,
        voiceNumber,
        volume,
      );
      debouncedRefresh();
    },
    [props.kitName, debouncedRefresh],
  );

  // Handle sample mode change — update local state + persist via IPC
  const handleSampleModeChange = React.useCallback(
    (voiceNumber: number, mode: SampleMode) => {
      setSampleModes((prev) => ({ ...prev, [voiceNumber]: mode }));
      window.electronAPI?.updateVoiceSampleMode?.(
        props.kitName,
        voiceNumber,
        mode,
      );
      props.onVoiceSettingChanged?.();
    },
    [props.kitName, props.onVoiceSettingChanged],
  );

  // Handle trigger condition change — update local state + persist
  const handleConditionChange = React.useCallback(
    (voiceIdx: number, stepIdx: number, condition: TriggerCondition) => {
      const newConditions = props.triggerConditions.map((row, v) =>
        v === voiceIdx
          ? row.map((c, s) => (s === stepIdx ? condition : c))
          : row,
      );
      props.setTriggerConditions(newConditions);
    },
    [props.triggerConditions, props.setTriggerConditions],
  );

  // Compute stereo-linked voice pairs from voice data
  const stereoLinks = React.useMemo<StereoLinks>(() => {
    const linkedSecondaries = new Set<number>();
    const primaryLabels: Record<number, string> = {};

    if (props.voices) {
      for (const voice of props.voices) {
        if (voice.stereo_mode && voice.voice_number < NUM_VOICES) {
          const secondary = voice.voice_number + 1;
          linkedSecondaries.add(secondary);
          primaryLabels[voice.voice_number] =
            `${voice.voice_number}+${secondary}`;
        }
      }
    }

    return { linkedSecondaries, primaryLabels };
  }, [props.voices]);

  // Pass the current BPM from bpmLogic to sequencer logic for live updates
  const logic = useKitStepSequencerLogic({
    ...props,
    bpm: bpmLogic.bpm,
    sampleModes,
    stereoLinks,
    triggerConditions: props.triggerConditions,
    voiceMutes,
    voiceVolumes,
  });

  return (
    <StepSequencerDrawer
      sequencerOpen={props.sequencerOpen}
      setSequencerOpen={props.setSequencerOpen}
    >
      <div className="flex flex-row items-center justify-center gap-2">
        {/* Transport column — left */}
        <StepSequencerControls
          bpmLogic={bpmLogic}
          cycleCount={logic.cycleCount}
          isSeqPlaying={logic.isSeqPlaying}
          kitName={props.kitName}
          setIsSeqPlaying={logic.setIsSeqPlaying}
        />
        {/* Grid with integrated voice controls on right */}
        <StepSequencerGrid
          currentSeqStep={logic.currentSeqStep}
          focusedStep={logic.focusedStep}
          gridRef={props.gridRef || logic.gridRefInternal}
          handleStepGridKeyDown={logic.handleStepGridKeyDown}
          isSeqPlaying={logic.isSeqPlaying}
          LED_GLOWS={logic.LED_GLOWS}
          NUM_STEPS={logic.NUM_STEPS}
          NUM_VOICES={logic.NUM_VOICES}
          onConditionChange={handleConditionChange}
          onMuteToggle={handleMuteToggle}
          onSampleModeChange={handleSampleModeChange}
          onVolumeChange={handleVolumeChange}
          ROW_COLORS={logic.ROW_COLORS}
          safeStepPattern={logic.safeStepPattern}
          sampleModes={sampleModes}
          setFocusedStep={logic.setFocusedStep}
          stereoLinks={stereoLinks}
          toggleStep={logic.toggleStep}
          triggerConditions={props.triggerConditions}
          voiceMutes={voiceMutes}
          voiceVolumes={voiceVolumes}
        />
      </div>
    </StepSequencerDrawer>
  );
};

export default KitStepSequencer;

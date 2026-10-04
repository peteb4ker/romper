import type { KitWithRelations, Sample } from "@romper/shared/db/schema";

import { LinkIcon } from "@phosphor-icons/react";
import {
  checkStereoLink,
  describeMissingSampleFile,
  describeMixdownNote,
  describeMonoOnStereoPair,
  describeQuarantineProblem,
  describeStereoDropPrompt,
  describeUnlink,
  isLinkedAutomatically,
  isStereoSample,
  planKitStereo,
  QUARANTINE_NOTICE,
  STEREO_LABELS,
  stereoSampleOf,
  type StereoSampleState,
} from "@romper/shared/stereoLinkRules";
import React, { useId, useState } from "react";

import type { PlayOptions, SampleData, VoiceSamples } from "./kitTypes";

import { slotKey } from "../utils/slotKey";
import { useKitVoicePanels } from "./hooks/kit-management/useKitVoicePanels";
import { useStereoHandling } from "./hooks/sample-management/useStereoHandling";
import {
  type AddedDropFile,
  type StereoDropHandlers,
} from "./hooks/shared/useExternalDragHandlers";
import { useSettingSave } from "./hooks/shared/useSettingSave";
import KitVoicePanel from "./KitVoicePanel";
import ModalDialog from "./shared/ModalDialog";

interface KitVoicePanelsProps {
  flashVoices?: Set<number>; // Voices currently showing flash animation
  isEditable?: boolean; // Used directly in KitVoicePanel
  kit: KitWithRelations | null; // Used by useKitVoicePanels hook
  kitName: string; // Used by useKitVoicePanels hook
  onBatchDropComplete?: () => void;
  onKitModified?: (kitName: string) => void; // Gain changes mark the kit modified without a reload (RE-35)
  onKitUpdated?: () => Promise<void>; // Called after voice stereo mode changes to reload kit data
  onMessage?: (text: string, type?: string, duration?: number) => void; // Refused links and drops (RE-40)
  onPlay: (voice: number, slot: number) => void; // Used by useKitVoicePanels hook
  // New props for drag-and-drop sample management (Task 5.2.2 & 5.2.3)
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotNumber: number) => Promise<void>;
  onSampleKeyNav: (direction: "down" | "up") => void; // Used directly in KitVoicePanel
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  onSampleSelect: (voice: number, idx: number) => void; // Used by useKitVoicePanels hook
  onSaveVoiceName: (voice: number, newName: string) => Promise<boolean> | void; // Used by useKitVoicePanels hook
  onStop: (voice: number, slot: number) => void; // Used by useKitVoicePanels hook
  onWaveformPlayingChange: (
    voice: number,
    slot: number,
    playing: boolean,
  ) => void; // Used by useKitVoicePanels hook
  playOptions?: { [key: string]: PlayOptions | undefined }; // Region and start time per sample key, set by sequencer
  playTriggers: { [key: string]: number }; // Used by useKitVoicePanels hook
  playVolumes?: { [key: string]: number }; // Volume per sample key, set by sequencer
  samplePlaying: { [key: string]: boolean }; // Used by useKitVoicePanels hook
  samples: VoiceSamples; // Used by useKitVoicePanels hook
  selectedSampleIdx: number; // Used by useKitVoicePanels hook

  selectedVoice: number; // Used by useKitVoicePanels hook
  sequencerOpen: boolean; // Used by useKitVoicePanels hook
  setSelectedSampleIdx: (i: number) => void; // Used by useKitVoicePanels hook
  setSelectedVoice: (v: number) => void; // Used by useKitVoicePanels hook

  stopTriggers: { [key: string]: number }; // Used by useKitVoicePanels hook
}

/** Main refused a link or unlink; its message says why (#541, RE-71) */
class StereoRefusal extends Error {}

/** A gain as the knob shows it: "+3 dB", "0 dB", "-6 dB" */
function formatGain(db: number): string {
  const rounded = Math.round(db);
  return rounded > 0 ? `+${rounded} dB` : `${rounded} dB`;
}

const KitVoicePanels: React.FC<KitVoicePanelsProps> = (props) => {
  const hookProps = useKitVoicePanels({
    ...props,
    sequencerOpen: props.sequencerOpen,
    setSelectedSampleIdx: props.setSelectedSampleIdx,
    setSelectedVoice: props.setSelectedVoice,
  });

  // Stereo handling hook for voice linking
  const stereoHandling = useStereoHandling();

  // Sample metadata (gain, WAV header) per slot, keyed by slotKey(voice,
  // slot). Not by file name: two slots can hold files with the same name,
  // and each has its own gain (RE-45).
  const [sampleMetadata, setSampleMetadata] = useState<{
    [slotKey: string]: SampleData;
  }>({});
  // Gain saves; reset when the metadata is reloaded from main (RE-91)
  const { reset: resetGainSaves, save: saveGain } = useSettingSave<
    string,
    number
  >();

  // Get voice data from kit with fallback defaults
  const voiceData = React.useMemo(() => {
    if (!props.kit?.voices) {
      // Fallback to default voice structure if no voices in kit
      return [1, 2, 3, 4].map((voice_number) => ({
        id: voice_number,
        kit_name: hookProps.kitName || "",
        sample_mode: "first",
        slice_enabled: false,
        slice_max_length: 2,
        slice_roll_amount: 100,
        slice_vary_length: false,
        stereo_choice: null,
        stereo_mode: false,
        voice_alias: null,
        voice_number,
        voice_volume: 100,
      }));
    }

    // Use actual voice data from database
    return props.kit.voices.map((voice) => ({
      id: voice.id,
      kit_name: voice.kit_name,
      sample_mode: voice.sample_mode || "first",
      slice_enabled: voice.slice_enabled ?? false,
      slice_max_length: voice.slice_max_length ?? 2,
      slice_roll_amount: voice.slice_roll_amount ?? 100,
      slice_vary_length: voice.slice_vary_length ?? false,
      stereo_choice: voice.stereo_choice ?? null,
      stereo_mode: voice.stereo_mode || false,
      voice_alias: voice.voice_alias,
      voice_number: voice.voice_number,
      voice_volume: voice.voice_volume ?? 100,
    }));
  }, [props.kit?.voices, hookProps.kitName]);

  // Convert sample data for stereo handling
  const sampleData = React.useMemo(() => {
    const samples: Sample[] = [];
    if (sampleMetadata) {
      Object.values(sampleMetadata).forEach((data) => {
        const filename = data.filename;
        // Simple hash of filename for deterministic ID generation
        const hash = filename
          .split("")
          .reduce(
            (acc, char) => (acc << 5) - acc + (char.codePointAt(0) ?? 0),
            0,
          );
        samples.push({
          filename,
          gain_db: data.gain_db ?? 0,
          id: Math.abs(hash), // Ensure positive ID
          kit_name: hookProps.kitName || "",
          slot_number: data.slot_number ?? 0,
          source_path: data.source_path,
          source_status:
            (data.source_status as Sample["source_status"]) ?? null,
          voice_number: data.voice_number ?? 1,
          wav_bit_depth: data.wav_bit_depth || null,
          wav_bitrate: data.wav_bitrate || null,
          wav_channels: data.wav_channels || null,
          wav_sample_rate: data.wav_sample_rate || null,
        });
      });
    }
    return samples;
  }, [sampleMetadata, hookProps.kitName]);

  // Writes a voice's stereo setting; a refusal from main fails the link or
  // unlink, so the user hears about it (RE-40)
  const writeStereoMode = React.useCallback(
    async (voiceNumber: number, updates: { stereo_mode?: boolean }) => {
      const result = await globalThis.electronAPI?.updateVoiceStereoMode?.(
        hookProps.kitName,
        voiceNumber,
        updates.stereo_mode ?? false,
      );
      if (result && !result.success) {
        throw new StereoRefusal(result.error || "updateVoiceStereoMode failed");
      }
    },
    [hookProps.kitName],
  );

  // The kit's samples as the stereo rules see them (#537): which voices
  // hold samples (from the panels), each one's channel count, and whether
  // its file was last found unreadable. Missing metadata alone isn't.
  const stereoSamples = React.useMemo(() => {
    const result: StereoSampleState[] = [];
    for (const voice of [1, 2, 3, 4]) {
      (hookProps.samples[voice] || []).forEach((name, slot) => {
        if (!name?.trim()) return;
        const meta = sampleMetadata[slotKey(voice, slot)];
        result.push(
          stereoSampleOf({
            filename: name,
            source_status: meta?.source_status,
            voice_number: voice,
            wav_channels: meta?.wav_channels,
          }),
        );
      });
    }
    return result;
  }, [hookProps.samples, sampleMetadata]);

  // Samples whose file was last found missing: skipped at write, and the
  // kit editor says how to fix it (#537)
  const missingFiles = React.useMemo(
    () =>
      Object.values(sampleMetadata)
        .filter((data) => data.source_status === "missing")
        .sort(
          (a, b) =>
            (a.voice_number ?? 0) - (b.voice_number ?? 0) ||
            (a.slot_number ?? 0) - (b.slot_number ?? 0),
        ),
    [sampleMetadata],
  );

  // What the rules make of the kit: mixdowns, quarantine (#537)
  const stereoPlan = React.useMemo(
    () => planKitStereo(voiceData, stereoSamples),
    [voiceData, stereoSamples],
  );

  const isVoiceLinked = React.useCallback(
    (voice: number) =>
      voiceData.some((v) => v.voice_number === voice && v.stereo_mode),
    [voiceData],
  );
  const hasStereoSamples = React.useCallback(
    (voice: number) =>
      stereoSamples.some((s) => s.voice_number === voice && isStereoSample(s)),
    [stereoSamples],
  );

  // Voice linking handlers. The link button refuses what main refuses,
  // in the same words (#541)
  const handleVoiceLink = React.useCallback(
    async (primaryVoice: number) => {
      const check = checkStereoLink(primaryVoice, voiceData, stereoSamples);
      if (!check.canLink) {
        props.onMessage?.(check.message, "warning");
        return;
      }

      // Main's refusal is shown as it says it; any other failure isn't
      let refusal: string | undefined;
      const result = await stereoHandling.linkVoicesForStereo(
        primaryVoice,
        voiceData,
        sampleData,
        async (voice, updates) => {
          try {
            await writeStereoMode(voice, updates);
          } catch (error) {
            if (error instanceof StereoRefusal) refusal = error.message;
            throw error;
          }
        },
      );
      if (!result.success) {
        props.onMessage?.(
          refusal ??
            `Voices ${primaryVoice} and ${primaryVoice + 1} weren't linked. Check that the kit is editable and voice ${primaryVoice + 1} is empty, then try again.`,
          "error",
        );
      }
      await props.onKitUpdated?.();
    },
    [
      stereoHandling,
      voiceData,
      sampleData,
      stereoSamples,
      writeStereoMode,
      props,
    ],
  );

  // Unlinking is always allowed and moves nothing; it says what changes on
  // the card, and Romper won't link the voice automatically again (#537)
  const handleVoiceUnlink = React.useCallback(
    async (primaryVoice: number) => {
      const result = await stereoHandling.unlinkVoices(
        primaryVoice,
        voiceData,
        writeStereoMode,
      );
      if (!result.success) {
        props.onMessage?.(
          `Voices ${primaryVoice} and ${primaryVoice + 1} weren't unlinked. Check that the kit is editable, then try again.`,
          "error",
        );
        return;
      }
      const stereo = hasStereoSamples(primaryVoice);
      props.onMessage?.(
        describeUnlink(primaryVoice, stereo),
        stereo ? "warning" : "info",
      );
      await props.onKitUpdated?.();
    },
    [stereoHandling, voiceData, writeStereoMode, hasStereoSamples, props],
  );

  // A drop of a stereo sample on a mono voice that rule 2 would link asks
  // Link or Keep mono, and the answer is remembered (#537)
  const [stereoPrompt, setStereoPrompt] = useState<{
    fileName: string;
    resolve: (link: boolean) => void;
    voice: number;
  } | null>(null);
  const stereoPromptId = useId();
  const answerStereoPrompt = React.useCallback(
    (link: boolean) => {
      stereoPrompt?.resolve(link);
      setStereoPrompt(null);
    },
    [stereoPrompt],
  );
  // A prompt still open when the panels go away keeps the voice as it is
  const stereoPromptRef = React.useRef(stereoPrompt);
  stereoPromptRef.current = stereoPrompt;
  React.useEffect(() => () => stereoPromptRef.current?.resolve(false), []);

  const { onKitUpdated, onMessage: showMessage } = props;
  const stereoDrop = React.useMemo<StereoDropHandlers>(
    () => ({
      report: async (voice: number, added: AddedDropFile[]) => {
        if (isVoiceLinked(voice)) {
          // A mono sample on a stereo pair is added with a warning; the
          // kit is quarantined until it's fixed (rule 4)
          const warnings = added
            .filter((f) => f.channels === 1)
            .map((f) => describeMonoOnStereoPair(f.fileName, voice));
          if (warnings.length > 0) {
            showMessage?.(warnings.join(" "), "warning");
          }
          return;
        }
        const stereoAdded = added.filter((f) => (f.channels ?? 0) > 1);
        if (stereoAdded.length === 0) return;
        // Would rule 2 link the voice, now the drop is in?
        const after = [
          ...stereoSamples,
          ...added.map((f) => ({
            filename: f.fileName,
            voice_number: voice,
            wav_channels: f.channels,
          })),
        ];
        if (!planKitStereo(voiceData, after).autoLinks.includes(voice)) {
          return; // A mono voice: its note says it's mixed down
        }
        const link = await new Promise<boolean>((resolve) =>
          setStereoPrompt({
            fileName: stereoAdded[0].fileName,
            resolve,
            voice,
          }),
        );
        try {
          // Link, or record Keep mono so it isn't linked automatically
          await writeStereoMode(voice, { stereo_mode: link });
          await onKitUpdated?.();
        } catch (error) {
          showMessage?.(
            error instanceof StereoRefusal
              ? error.message
              : `Voices ${voice} and ${voice + 1} weren't linked. Check that the kit is editable and voice ${voice + 1} is empty, then try again.`,
            "error",
          );
        }
      },
    }),
    [
      isVoiceLinked,
      onKitUpdated,
      showMessage,
      stereoSamples,
      voiceData,
      writeStereoMode,
    ],
  );

  // State to track internal drag operations across all voices
  const [internalDraggedSample, setInternalDraggedSample] = useState<{
    sampleName: string;
    slot: number;
    voice: number;
  } | null>(null);

  // Once per kit open, main checks the kit's sample files in one batch, so
  // missing and unreadable files show early (#537): every file is checked
  // to still exist, and only files not known to be readable are read. A
  // change reloads the kit.
  const checkedKits = React.useRef(new Set<string>());
  const { onKitUpdated: reloadKitAfterCheck } = props;
  const checkSampleFilesOnce = React.useCallback(
    async (loaded: Sample[]) => {
      const kitName = hookProps.kitName;
      if (checkedKits.current.has(kitName)) return;
      if (loaded.length === 0) return;
      checkedKits.current.add(kitName);
      const checked =
        await globalThis.electronAPI?.checkKitSampleFiles?.(kitName);
      if (checked?.success && (checked.data?.changed ?? 0) > 0) {
        await reloadKitAfterCheck?.();
      }
    },
    [hookProps.kitName, reloadKitAfterCheck],
  );

  // Load sample metadata when kit changes
  React.useEffect(() => {
    const loadSampleMetadata = async () => {
      if (!hookProps.kitName || !globalThis.electronAPI?.getAllSamplesForKit) {
        setSampleMetadata({});
        return;
      }

      try {
        const samplesResult = await globalThis.electronAPI.getAllSamplesForKit(
          hookProps.kitName,
        );
        if (samplesResult?.success && samplesResult.data) {
          const metadata: { [slotKey: string]: SampleData } = {};
          samplesResult.data.forEach((sample: Sample) => {
            metadata[slotKey(sample.voice_number, sample.slot_number)] = {
              filename: sample.filename,
              gain_db: sample.gain_db ?? 0,
              slot_number: sample.slot_number,
              source_path: sample.source_path,
              source_status: sample.source_status,
              voice_number: sample.voice_number,
              wav_bit_depth: sample.wav_bit_depth ?? undefined,
              wav_bitrate: sample.wav_bitrate ?? undefined,
              wav_channels: sample.wav_channels ?? undefined,
              wav_sample_rate: sample.wav_sample_rate ?? undefined,
            };
          });
          setSampleMetadata(metadata);
          resetGainSaves();
          void checkSampleFilesOnce(samplesResult.data);
        }
      } catch (error) {
        console.error("Failed to load sample metadata:", error);
        setSampleMetadata({});
      }
    };

    void loadSampleMetadata();
  }, [hookProps.kitName, props.kit, resetGainSaves, checkSampleFilesOnce]);

  // Optimistic update for gain changes so SampleWaveform gets the new
  // gainDb immediately. Main marks the kit modified with the gain (RE-35),
  // so the kit's card shows it too, without reloading every kit. If main
  // doesn't save it, the knob goes back and a message says so (RE-91).
  const { onKitModified, onMessage } = props;
  const setSlotGain = React.useCallback((key: string, gainDb: number) => {
    setSampleMetadata((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      return { ...prev, [key]: { ...existing, gain_db: gainDb } };
    });
  }, []);
  const handleGainChange = React.useCallback(
    (voice: number, slotNumber: number, sampleName: string, gainDb: number) => {
      const key = slotKey(voice, slotNumber);
      setSlotGain(key, gainDb);
      void saveGain({
        current: sampleMetadata[key]?.gain_db ?? 0,
        key,
        onSaved: () => onKitModified?.(hookProps.kitName),
        report: (saved) =>
          onMessage?.(
            `Couldn't save the gain for ${sampleName}, so it's back to ${formatGain(saved)}. Try again.`,
            "error",
          ),
        restore: (saved) => setSlotGain(key, saved),
        send: () =>
          globalThis.electronAPI?.updateSampleGain?.(
            hookProps.kitName,
            voice,
            slotNumber,
            gainDb,
          ),
        value: gainDb,
        what: `the gain for voice ${voice} slot ${slotNumber}`,
      });
    },
    [
      hookProps.kitName,
      onKitModified,
      onMessage,
      sampleMetadata,
      saveGain,
      setSlotGain,
    ],
  );

  // Track which voices were recently visible so content stays rendered during collapse animation
  const [deferredSecondaries, setDeferredSecondaries] = useState<Set<number>>(
    new Set(),
  );

  React.useEffect(() => {
    const currentSecondaries = new Set<number>();
    for (const voice of voiceData) {
      const status = stereoHandling.getVoiceLinkingStatus(
        voice.voice_number,
        voiceData,
      );
      if (status.isLinked && !status.isPrimary) {
        currentSecondaries.add(voice.voice_number);
      }
    }

    // If a voice just became secondary, delay hiding its content until animation completes
    const newlyHidden = [...currentSecondaries].filter(
      (v) => !deferredSecondaries.has(v),
    );
    if (newlyHidden.length > 0) {
      const timer = setTimeout(() => {
        setDeferredSecondaries(currentSecondaries);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }

    setDeferredSecondaries(currentSecondaries);
  }, [voiceData, stereoHandling.getVoiceLinkingStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col w-full">
      {stereoPlan.quarantine.length > 0 && (
        <div
          className="mb-2 px-3 py-2 rounded border border-accent-danger/40 bg-accent-danger/10 text-xs text-text-primary"
          data-testid="kit-quarantine-notice"
          role="status"
        >
          <p className="font-medium">
            <span
              className="mr-2 px-1.5 py-0.5 rounded bg-accent-danger text-white"
              data-testid="kit-quarantined-label"
            >
              {STEREO_LABELS.quarantined}
            </span>
            {QUARANTINE_NOTICE}
          </p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {stereoPlan.quarantine.map((problem) => (
              <li
                key={`${problem.kind}-${problem.voiceNumber}-${"filename" in problem ? problem.filename : ""}`}
              >
                {describeQuarantineProblem(problem)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {missingFiles.length > 0 && (
        <div
          className="mb-2 px-3 py-2 rounded border border-accent-warning/40 bg-accent-warning/10 text-xs text-text-primary"
          data-testid="kit-missing-files-notice"
          role="status"
        >
          <ul className="list-disc pl-5 space-y-0.5">
            {missingFiles.map((file) => (
              <li key={`${file.voice_number}-${file.slot_number}`}>
                {describeMissingSampleFile(
                  file.filename,
                  file.voice_number ?? 1,
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex w-full relative" data-testid="voice-panels-row">
        {/* Global slot numbers column */}
        <div className="flex flex-col justify-start pt-8 pr-3">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((slotNumber) => (
            <div
              className="min-h-[28px] flex items-center justify-end"
              key={`global-slot-${slotNumber}`}
              style={{ marginBottom: 4 }}
            >
              <span
                className="text-xs font-mono text-text-tertiary select-none bg-surface-3 px-1.5 py-0.5 rounded text-center w-8 h-5 flex items-center justify-center inline-block"
                data-testid={`global-slot-number-${slotNumber - 1}`}
                style={{ display: "inline-block", width: "32px" }}
              >
                {slotNumber}
              </span>
            </div>
          ))}
        </div>

        {/* Voice panels flex layout */}
        <div
          className="flex gap-1.5 flex-1 min-w-0"
          data-testid="voice-panels-flex"
        >
          {[1, 2, 3, 4].map((voice) => {
            // Get voice linking status
            const linkingStatus = stereoHandling.getVoiceLinkingStatus(
              voice,
              voiceData,
            );
            const isSecondary =
              linkingStatus.isLinked && !linkingStatus.isPrimary;
            const isPrimary = linkingStatus.isLinked && linkingStatus.isPrimary;
            const nextVoiceLinked =
              voice < 4 &&
              stereoHandling.getVoiceLinkingStatus(voice + 1, voiceData)
                .isLinked;
            // Linking is an edit (RE-71): no link control on a read-only kit
            const showChainIcon =
              Boolean(props.isEditable) &&
              voice < 4 &&
              !isPrimary &&
              !isSecondary &&
              !nextVoiceLinked;

            return (
              <div
                className={[
                  "group/panel relative transition-all duration-300 ease-in-out overflow-hidden",
                  isSecondary ? "opacity-0" : "flex-1 w-0 opacity-100",
                ].join(" ")}
                data-testid={`voice-panel-${voice}`}
                key={`${hookProps.kitName}-voicepanel-${voice}`}
                style={(() => {
                  if (isSecondary)
                    return { flex: 0, gap: 0, minWidth: 0, padding: 0 };
                  if (isPrimary) return { flex: 2 };
                  return undefined;
                })()}
              >
                {!deferredSecondaries.has(voice) && (
                  <KitVoicePanel
                    dataTestIdVoiceName={`voice-name-${voice}`}
                    isActive={voice === hookProps.selectedVoice}
                    isDisabled={isSecondary}
                    isEditable={props.isEditable ?? false}
                    isFlashing={props.flashVoices?.has(voice) ?? false}
                    isLinkedPrimary={isPrimary}
                    kitName={hookProps.kitName}
                    linkedAutomatically={
                      isPrimary &&
                      voiceData.some(
                        (v) =>
                          v.voice_number === voice && isLinkedAutomatically(v),
                      )
                    }
                    linkedWith={linkingStatus.linkedWith}
                    onBatchDropComplete={props.onBatchDropComplete}
                    onGainChange={handleGainChange}
                    onMessage={props.onMessage}
                    onPlay={hookProps.onPlay}
                    onSampleAdd={props.onSampleAdd}
                    onSampleDelete={props.onSampleDelete}
                    onSampleKeyNav={hookProps.onSampleKeyNav}
                    onSampleMove={props.onSampleMove}
                    onSampleReplace={props.onSampleReplace}
                    onSampleSelect={hookProps.onSampleSelect}
                    onSaveVoiceName={hookProps.onSaveVoiceName}
                    onStop={hookProps.onStop}
                    onVoiceUnlink={handleVoiceUnlink}
                    onWaveformPlayingChange={hookProps.onWaveformPlayingChange}
                    playOptions={hookProps.playOptions}
                    playTriggers={hookProps.playTriggers}
                    playVolumes={hookProps.playVolumes}
                    sampleMetadata={sampleMetadata}
                    samplePlaying={hookProps.samplePlaying}
                    samples={hookProps.samples[voice] || []}
                    selectedIdx={
                      voice === hookProps.selectedVoice
                        ? hookProps.selectedSampleIdx
                        : -1
                    }
                    setSharedDraggedSample={setInternalDraggedSample}
                    sharedDraggedSample={internalDraggedSample}
                    stereoDrop={stereoDrop}
                    stereoNote={(() => {
                      const mixdown = stereoPlan.mixdowns.find(
                        (m) => m.voiceNumber === voice,
                      );
                      return mixdown ? describeMixdownNote(mixdown) : undefined;
                    })()}
                    stopTriggers={hookProps.stopTriggers}
                    voice={voice}
                    voiceName={
                      hookProps.kit?.voices?.find(
                        (v) => v.voice_number === voice,
                      )?.voice_alias || null
                    }
                  />
                )}
                {/* Chain icon — right edge of panel, always visible */}
                {showChainIcon && (
                  <div
                    className="absolute right-0 top-0 z-10"
                    data-testid={`chain-icon-${voice}-${voice + 1}`}
                  >
                    <button
                      className="opacity-80 hover:opacity-100 transition-opacity text-text-secondary"
                      data-testid={`link-button-${voice}-${voice + 1}`}
                      onClick={() => handleVoiceLink(voice)}
                      title="Click to link stereo channels"
                      type="button"
                    >
                      <LinkIcon size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {stereoPrompt && (
          <ModalDialog
            aria-labelledby={stereoPromptId}
            className="bg-surface-2 rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.4)] border border-border-subtle p-6 w-full max-w-md"
            data-testid="stereo-drop-prompt"
            // Escape keeps the voice as it is
            onClose={() => answerStereoPrompt(false)}
          >
            <p className="text-sm text-text-primary" id={stereoPromptId}>
              {describeStereoDropPrompt(
                stereoPrompt.fileName,
                stereoPrompt.voice,
              )}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="bg-surface-4 text-text-primary px-4 py-2 rounded"
                data-testid="stereo-drop-keep-mono"
                onClick={() => answerStereoPrompt(false)}
                type="button"
              >
                Keep mono
              </button>
              <button
                autoFocus
                className="bg-accent-primary text-white px-4 py-2 rounded"
                data-testid="stereo-drop-link"
                onClick={() => answerStereoPrompt(true)}
                type="button"
              >
                Link
              </button>
            </div>
          </ModalDialog>
        )}
      </div>
    </div>
  );
};

export default KitVoicePanels;

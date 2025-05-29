import React, { useRef } from 'react';
import { inferVoiceTypeFromFilename } from './kitUtils';
import VoiceSamplesList from './VoiceSamplesList';
import SampleWaveform from './SampleWaveform';
import { FiPlay, FiSquare, FiEdit2, FiCheck, FiX, FiTrash2, FiRefreshCw, FiArrowLeft, FiChevronLeft, FiChevronRight, FiFolder } from 'react-icons/fi';
import KitVoicePanel from './KitVoicePanel';
import KitMetadataForm from './KitMetadataForm';
import KitPlanEditor, { getPlanVoiceSlots } from './KitPlanEditor';
import { useKitPlayback } from './hooks/useKitPlayback';
import { useKitPlanActions } from './hooks/useKitPlanActions';
import type { KitSamplePlanSlot, RampleKitLabel, RampleLabels, KitDetailsProps, VoiceSamples } from './kitTypes';
import KitHeader from './KitHeader';

const KitDetails: React.FC<KitDetailsProps & { kitLabel?: RampleKitLabel; onRescanAllVoiceNames?: () => void; onCreateKit?: () => void }> = (props) => {
    const { samples, kitLabel } = props;

    // --- Plan state management ---
    const [plan, setPlan] = React.useState<KitSamplePlanSlot[] | null>(kitLabel?.plan ? [...kitLabel.plan] : null);
    React.useEffect(() => {
        if (kitLabel && kitLabel.plan) {
            setPlan([...kitLabel.plan]);
        } else {
            setPlan(null);
        }
    }, [kitLabel]);

    // Playback logic
    const {
        playbackError,
        playTriggers,
        stopTriggers,
        samplePlaying,
        handlePlay,
        handleStop,
        handleWaveformPlayingChange
    } = useKitPlayback(samples);

    // Plan commit/discard logic
    const { planActionStatus, handleCommitPlan, handleDiscardPlan } = useKitPlanActions(props.sdCardPath, props.kitName, props.onRescanAllVoiceNames);

    // Add new plan logic for per-voice assignment
    const handleAddSampleToPlan = (voice: number, sample: string) => {
        if (!props.kitLabel) return;
        if (!plan) return;
        // Prevent duplicates in this voice
        const planForVoice = getPlanVoiceSlots(plan)[voice];
        if (planForVoice.find((slot: any) => slot.target === sample)) return;
        // Find source path from samples
        const samplePath = samples[voice]?.find((s: any) => s === sample) ? `${props.sdCardPath}/${props.kitName}/${sample}` : '';
        if (!samplePath) return;
        const newSlot: KitSamplePlanSlot = {
            source: samplePath,
            target: sample,
            voice,
            voiceType: inferVoiceTypeFromFilename(sample) || undefined,
        };
        setPlan([...(plan || []), newSlot]);
    };
    const handleDeletePlanSlotByVoice = (voice: number, idx: number) => {
        if (!plan) return;
        const voices = getPlanVoiceSlots(plan);
        const newVoiceSlots = voices[voice].filter((_: any, i: number) => i !== idx);
        // Flatten all voices back into a single plan array
        const newPlan = ([] as KitSamplePlanSlot[]).concat(
            ...[1,2,3,4].map(v => v === voice ? newVoiceSlots : voices[v])
        );
        setPlan(newPlan);
    };

    // Only auto-scan once per kit load, and only after samples are loaded
    const scannedRef = useRef(false);
    React.useEffect(() => {
        if (!kitLabel || !samples) return;
        const allMissing = [1,2,3,4].every(v => {
            const name = kitLabel.voiceNames?.[v];
            return name === undefined || name === null || name === '';
        });
        // Only scan if at least one sample is present (prevents running before samples load)
        const samplesLoaded = [1,2,3,4].some(v => (samples[v] && samples[v].length > 0));
        if (allMissing && samplesLoaded && !scannedRef.current && props.onRescanAllVoiceNames) {
            props.onRescanAllVoiceNames();
            scannedRef.current = true;
        }
    }, [kitLabel, samples, props.onRescanAllVoiceNames]);
    // Reset scan flag when kit changes
    React.useEffect(() => {
        scannedRef.current = false;
    }, [props.kitName]);

    // Save a voice name for a given voice number
    const handleSaveVoiceName = (voice: number, newName: string) => {
        if (!props.kitLabel) return;
        if (!props.kitLabel.voiceNames) props.kitLabel.voiceNames = {};
        props.kitLabel.voiceNames[voice] = newName;
        // Optionally trigger a parent update or persist here
        setPlan(plan => plan ? [...plan] : plan); // trigger re-render if needed
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
            <KitHeader
                kitName={props.kitName}
                kitLabel={kitLabel}
                onBack={props.onBack}
                onNextKit={props.onNextKit}
                onPrevKit={props.onPrevKit}
                onCreateKit={props.onCreateKit}
                kits={props.kits}
                kitIndex={props.kitIndex}
                onAddPlan={() => handleSaveKitPlan([])}
                // Always show navigation buttons, but disable as needed
                disablePrev={props.kitIndex === 0}
                disableNext={props.kits && props.kitIndex === (props.kits.length - 1)}
            />
            <KitMetadataForm
                kitLabel={kitLabel}
                loading={false}
                error={null}
                editing={false}
                onEdit={() => {}}
                onCancel={() => {}}
                onSave={(label, _description, _tags) => {
                  handleSaveKitLabel(label);
                }}
                hideDescription={true}
                tagsEditable={false} // Remove tag editing
            />
            {playbackError && (
                <div className="text-xs text-red-500 mb-2">{playbackError}</div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((voice) => (
                        <KitVoicePanel
                            key={`${props.kitName}-${voice}`}
                            voice={voice}
                            samples={samples[voice] || []}
                            voiceName={props.kitLabel?.voiceNames?.[voice] || null}
                            onSaveVoiceName={handleSaveVoiceName}
                            onRescanVoiceName={() => handleRescanVoiceName(voice, samples)}
                            samplePlaying={samplePlaying}
                            playTriggers={playTriggers}
                            stopTriggers={stopTriggers}
                            onPlay={handlePlay}
                            onStop={handleStop}
                            onWaveformPlayingChange={handleWaveformPlayingChange}
                            sdCardPath={props.sdCardPath}
                            kitName={props.kitName}
                            usePlanSource={false}
                        />
                    ))}
                </div>
            </div>
            {plan && (
                <KitPlanEditor
                    plan={plan}
                    samples={samples}
                    sdCardPath={props.sdCardPath}
                    kitName={props.kitName}
                    onSavePlan={handleSaveKitPlan}
                    onCommitPlan={handleCommitPlan}
                    onDiscardPlan={handleDiscardPlan}
                    planActionStatus={planActionStatus}
                />
            )}
        </div>
    );
};

export default KitDetails;
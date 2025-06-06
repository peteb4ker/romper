import React from 'react';
import { inferVoiceTypeFromFilename } from './kitUtils';
import VoiceSamplesList from './VoiceSamplesList';
import SampleWaveform from './SampleWaveform';
import { FiPlay, FiSquare, FiEdit2, FiCheck, FiX, FiTrash2, FiRefreshCw, FiArrowLeft, FiChevronLeft, FiChevronRight, FiFolder } from 'react-icons/fi';
import KitVoicePanel from './KitVoicePanel';
import KitMetadataForm from './KitMetadataForm';
import { useKitPlayback } from './hooks/useKitPlayback';
import { useKitLabel } from './hooks/useKitLabel';
import { useKitDetails } from './hooks/useKitDetails';
import { useKitVoicePanel } from './hooks/useKitVoicePanel';
import { useKitPreview } from './hooks/useKitPreview';
import KitStepSequencer from './KitStepSequencer';
import type { RampleKitLabel, RampleLabels, KitDetailsProps, VoiceSamples } from './kitTypes';
import KitHeader from './KitHeader';
import { useMessageApi } from './hooks/useMessageApi';

const KitDetails: React.FC<KitDetailsProps & { kitLabel?: RampleKitLabel; onRescanAllVoiceNames?: () => void; onCreateKit?: () => void }> = (props) => {
    const messageApi = useMessageApi();

    // Playback logic
    const {
        playbackError,
        playTriggers,
        stopTriggers,
        samplePlaying,
        handlePlay,
        handleStop,
        handleWaveformPlayingChange
    } = useKitPlayback(props.samples);

    // Use the shared useKitLabel hook for all label/voice rescanning logic
    const {
        handleSaveVoiceName,
        handleRescanVoiceName,
        handleRescanAllVoiceNames,
        kitLabel: managedKitLabel,
        setKitLabel,
        labelsLoading,
        labelsError,
        editingKitLabel,
        setEditingKitLabel,
        kitLabelInput,
        setKitLabelInput,
        handleSaveKitLabel,
        handleSaveKitTags,
        handleSaveKitMetadata,
        reloadCounter, // <-- add this
        reloadKitLabel, // <-- add this
        stepPattern,
        setStepPattern,
    } = useKitLabel(props);

    // Full kit preview logic
    const {
        isPlaying: kitPreviewPlaying,
        error: kitPreviewError,
        handlePlayKit,
        handleStopKit,
        setError: setKitPreviewError
    } = useKitPreview(props.kitName, props.samples);

    // Default samples to avoid undefined errors
    const samples = props.samples || { 1: [], 2: [], 3: [], 4: [] };

    // Auto-scan logic: triggers auto-rescan if all voice names are missing and samples are loaded
    useKitDetails({
        kitLabel: managedKitLabel,
        samples,
        sdCardPath: props.sdCardPath,
        kitName: props.kitName,
        onRescanAllVoiceNames: () => handleRescanAllVoiceNames(samples)
    });

    // Remove reloadCounter effect: no need to force reload, hook handles it

    // Show playback errors via centralized message display
    React.useEffect(() => {
        if (playbackError) {
            messageApi.showMessage({ type: 'error', text: playbackError });
        }
    }, [playbackError]);

    // Show label errors via centralized message display
    React.useEffect(() => {
        if (labelsError) {
            messageApi.showMessage({ type: 'error', text: labelsError });
        }
    }, [labelsError]);

    // Show kit preview errors via centralized message display
    React.useEffect(() => {
        if (kitPreviewError) {
            messageApi.showMessage({ type: 'error', text: kitPreviewError });
        }
    }, [kitPreviewError]);

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
            <KitHeader
                kitName={props.kitName}
                kitLabel={managedKitLabel}
                onBack={props.onBack}
                onNextKit={props.onNextKit}
                onPrevKit={props.onPrevKit}
                onCreateKit={props.onCreateKit}
                kits={props.kits}
                kitIndex={props.kitIndex}
                // Always show navigation buttons, but disable as needed
                disablePrev={props.kitIndex === 0}
                disableNext={props.kits && props.kitIndex === (props.kits.length - 1)}
                onRescanAllVoiceNames={() => handleRescanAllVoiceNames(samples)}
            />
            <KitMetadataForm
                kitLabel={managedKitLabel}
                loading={labelsLoading}
                error={null} // error now handled by centralized message display
                editing={editingKitLabel}
                onEdit={() => setEditingKitLabel(true)}
                onCancel={() => setEditingKitLabel(false)}
                onSave={handleSaveKitLabel}
                hideDescription={true}
                tagsEditable={false} // Remove tag editing
            />
            {/* playbackError and labelsError are now handled by centralized message display */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((voice) => (
                        <div
                            key={`${props.kitName}-voicepanel-${voice}`}
                            onClick={() => {/* no-op or optional: could call a callback if needed */}}
                            data-testid={`voice-panel-${voice}`}
                        >
                            <KitVoicePanel
                                voice={voice}
                                samples={samples[voice] || []}
                                voiceName={managedKitLabel?.voiceNames?.[voice] || null}
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
                                // Add data-testid for voice name span for robust test selection
                                dataTestIdVoiceName={`voice-name-${voice}`}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {/* Step Sequencer Drawer */}
            <KitStepSequencer
                samples={samples}
                onPlaySample={handlePlay}
                stepPattern={stepPattern}
                setStepPattern={setStepPattern}
            />
        </div>
    );
};

export default KitDetails;
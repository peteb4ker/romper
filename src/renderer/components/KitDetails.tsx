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
import type { RampleKitLabel, RampleLabels, KitDetailsProps, VoiceSamples } from './kitTypes';
import KitHeader from './KitHeader';

const KitDetails: React.FC<KitDetailsProps & { kitLabel?: RampleKitLabel; onRescanAllVoiceNames?: () => void; onCreateKit?: () => void }> = (props) => {
    const { samples, kitLabel } = props;

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
    } = useKitLabel(props);

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
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
            />
            <KitMetadataForm
                kitLabel={managedKitLabel}
                loading={labelsLoading}
                error={labelsError}
                editing={editingKitLabel}
                onEdit={() => setEditingKitLabel(true)}
                onCancel={() => setEditingKitLabel(false)}
                onSave={handleSaveKitLabel}
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
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KitDetails;
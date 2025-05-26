import React, { useEffect, useState, useRef } from 'react';
import { groupSamplesByVoice, inferVoiceTypeFromFilename } from './kitUtils';
import VoiceSamplesList from './VoiceSamplesList';
import SampleWaveform from './SampleWaveform';
import { FiPlay, FiSquare, FiEdit2, FiCheck, FiX, FiTrash2, FiRefreshCw, FiArrowLeft, FiChevronLeft, FiChevronRight, FiFolder } from 'react-icons/fi';
import KitVoicePanel from './KitVoicePanel';
import KitMetadataForm from './KitMetadataForm';

// TypeScript interfaces for kit metadata (duplicated from backend for type safety)
export interface RampleKitLabel {
  label: string;
  description?: string;
  tags?: string[];
  voiceNames?: { [voice: number]: string | null };
}

export interface RampleLabels {
  kits: Record<string, RampleKitLabel>;
}

interface KitDetailsProps {
    kitName: string;
    sdCardPath: string;
    onBack: (scrollToKit?: string) => void;
    kits?: string[];
    kitIndex?: number;
    onNextKit?: () => void;
    onPrevKit?: () => void;
    samples?: VoiceSamples | null;
    onRequestSamplesReload?: () => void;
}

interface VoiceSamples {
    [voice: number]: string[];
}

const KitDetails: React.FC<KitDetailsProps> = ({ kitName, sdCardPath, onBack, kits, kitIndex, onNextKit, onPrevKit, samples: propSamples, onRequestSamplesReload }) => {
    const [samples, setSamples] = useState<VoiceSamples>(propSamples || {});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playTriggers, setPlayTriggers] = useState<{ [key: string]: number }>({});
    const [stopTriggers, setStopTriggers] = useState<{ [key: string]: number }>({});
    const [samplePlaying, setSamplePlaying] = useState<{ [key: string]: boolean }>({});
    const [kitLabel, setKitLabel] = useState<RampleKitLabel | null>(null);
    const [labelsLoading, setLabelsLoading] = useState(false);
    const [labelsError, setLabelsError] = useState<string | null>(null);
    const [voiceNames, setVoiceNames] = useState<{ [voice: number]: string | null }>({});
    const [editingKitMetadata, setEditingKitMetadata] = useState(false);
    const [editingKitLabel, setEditingKitLabel] = useState(false);
    const [kitLabelInput, setKitLabelInput] = useState(kitLabel?.label || '');
    const kitLabelInputRef = useRef<HTMLInputElement>(null);
    const [metadataChanged, setMetadataChanged] = useState(false);

    // --- PATCH: Always use propSamples if provided, and update local state when it changes ---
    useEffect(() => {
        if (propSamples) {
            setSamples(propSamples);
            setLoading(false);
            setError(null);
        }
    }, [propSamples]);

    // Only load from disk if propSamples is null/undefined
    useEffect(() => {
        if (propSamples) return; // Don't load from disk if samples are provided
        const loadSamples = async () => {
            setLoading(true);
            setError(null);
            try {
                // @ts-ignore
                const kitPath = `${sdCardPath}/${kitName}`;
                // @ts-ignore
                const files: string[] = await window.electronAPI?.listFilesInRoot?.(kitPath);
                // Only .wav files, ignore others
                const wavFiles = files.filter(f => /\.wav$/i.test(f));
                // Use utility to group by voice
                const voices = groupSamplesByVoice(wavFiles);
                setSamples(voices);
                // Infer voice names if not set in metadata
                let inferred: { [voice: number]: string | null } = {};
                for (let v = 1; v <= 4; v++) {
                    const samplesForVoice = voices[v] || [];
                    let inferredName: string | null = null;
                    for (const sample of samplesForVoice) {
                        const type = inferVoiceTypeFromFilename(sample);
                        if (type) { inferredName = type; break; }
                    }
                    inferred[v] = inferredName;
                }
                setVoiceNames(inferred);
            } catch (e: any) {
                setError('Failed to load kit samples.');
            } finally {
                setLoading(false);
            }
        };
        loadSamples();
    }, [kitName, sdCardPath, propSamples]);

    // Play a sample (no pause)
    const handlePlay = (voice: number, sample: string) => {
        // Bump playTrigger for this sample to trigger waveform play
        setPlayTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setPlaybackError(null); // Clear previous error
    };

    const handleStop = (voice: number, sample: string) => {
        setStopTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setSamplePlaying(state => ({ ...state, [voice + ':' + sample]: false }));
    };

    // Listen for playback end and error from backend ONCE on mount
    useEffect(() => {
        // @ts-ignore
        const handleEnded = () => setLoading(false);
        // @ts-ignore
        const handleError = (errMsg: string) => {
            setLoading(false);
            setPlaybackError(errMsg || 'Playback failed');
        };
        // @ts-ignore
        window.electronAPI.onSamplePlaybackEnded?.(handleEnded);
        // @ts-ignore
        window.electronAPI.onSamplePlaybackError?.(handleError);
        return () => {
            // Remove the event listeners to avoid leaks
            // @ts-ignore
            window.electronAPI.onSamplePlaybackEnded?.(() => {});
            // @ts-ignore
            window.electronAPI.onSamplePlaybackError?.(() => {});
        };
    }, []);

    const handleWaveformPlayingChange = (voice: number, sample: string, playing: boolean) => {
        setSamplePlaying(state => ({ ...state, [voice + ':' + sample]: playing }));
    };

    // Load kit metadata from .rample_labels.json
    useEffect(() => {
        if (!sdCardPath || !kitName) return;
        setLabelsLoading(true);
        setLabelsError(null);
        // @ts-ignore
        window.electronAPI.readRampleLabels(sdCardPath)
            .then(async (labels: RampleLabels | null) => {
                if (labels && labels.kits && labels.kits[kitName]) {
                    const kit = labels.kits[kitName];
                    setKitLabel(kit);
                } else {
                    setKitLabel(null);
                }
            })
            .catch(e => setLabelsError('Failed to load kit metadata.'))
            .finally(() => setLabelsLoading(false));
    }, [sdCardPath, kitName]);

    // Save kit metadata handler for KitMetadataForm
    const handleSaveKitMetadata = async (label: string, description: string, tags: string[]) => {
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const newKitLabel: RampleKitLabel = { label };
        if (description.trim() !== '') newKitLabel.description = description.trim();
        if (tags.length > 0) newKitLabel.tags = tags;
        labels.kits[kitName] = newKitLabel;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        setKitLabel(newKitLabel);
    };

    // Save voice name handler for KitVoicePanel
    const handleSaveVoiceName = async (voice: number, newName: string) => {
        if (!sdCardPath || !kitName) return;
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const kit = labels.kits[kitName] || { label: kitName };
        const updatedVoiceNames = { ...(kit.voiceNames || {}), [voice]: newName };
        kit.voiceNames = updatedVoiceNames;
        labels.kits[kitName] = kit;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        setKitLabel({ ...kit, voiceNames: updatedVoiceNames });
    };

    // Handler to rescan (re-infer) a voice name, always overwriting
    const handleRescanVoiceName = async (voice: number) => {
        if (!sdCardPath || !kitName) return;
        // Reload sample list for this kit
        // @ts-ignore
        const kitPath = `${sdCardPath}/${kitName}`;
        // @ts-ignore
        const files: string[] = await window.electronAPI?.listFilesInRoot?.(kitPath);
        const wavFiles = files.filter(f => /\.wav$/i.test(f));
        const voices = groupSamplesByVoice(wavFiles);
        const samplesForVoice = voices[voice] || [];
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const kit = labels.kits[kitName] || { label: kitName };
        let inferredName: string | null = null;
        for (const sample of samplesForVoice) {
            const type = inferVoiceTypeFromFilename(sample);
            if (type) { inferredName = type; break; }
        }
        if (!kit.voiceNames) kit.voiceNames = {};
        kit.voiceNames[voice] = inferredName;
        labels.kits[kitName] = kit;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        // Reload from disk to ensure UI is in sync
        // @ts-ignore
        const updatedLabels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const updatedKit = updatedLabels.kits[kitName] || { label: kitName };
        setKitLabel(updatedKit);
        setVoiceNames(updatedKit.voiceNames || {});
    };

    useEffect(() => {
        setKitLabelInput(kitLabel?.label || '');
    }, [kitLabel?.label]);

    // Save kit label (name) handler
    const handleSaveKitLabel = async (newLabel: string) => {
        if (!sdCardPath || !kitName) return;
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const kit = labels.kits[kitName] || { label: kitName };
        kit.label = newLabel;
        labels.kits[kitName] = kit;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        setKitLabel({ ...kit });
        setMetadataChanged(true);
    };

    // Save kit tags handler
    const handleSaveKitTags = async (tags: string[]) => {
        if (!sdCardPath || !kitName) return;
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const kit = labels.kits[kitName] || { label: kitName };
        kit.tags = tags;
        labels.kits[kitName] = kit;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        setKitLabel({ ...kit });
        setMetadataChanged(true);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded shadow">
            {/* Static header and metadata section */}
            <div className="flex items-center mb-2">
                <FiFolder className="inline-block mr-2 align-text-bottom text-gray-500 dark:text-gray-400" aria-label="Kit folder" />
                <span className="font-mono text-base font-bold text-gray-800 dark:text-gray-100 mr-1">{kitName}</span>
                <span className="text-base font-bold text-gray-800 dark:text-gray-100 mr-1">:</span>
                {editingKitLabel ? (
                    <input
                        ref={kitLabelInputRef}
                        className="border-b border-blue-500 bg-transparent text-base font-bold text-gray-800 dark:text-gray-100 focus:outline-none px-1 w-48"
                        value={kitLabelInput}
                        onChange={e => setKitLabelInput(e.target.value)}
                        onBlur={() => {
                            setEditingKitLabel(false);
                            handleSaveKitLabel(kitLabelInput.trim());
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                setEditingKitLabel(false);
                                handleSaveKitLabel(kitLabelInput.trim());
                            } else if (e.key === 'Escape') {
                                setEditingKitLabel(false);
                                setKitLabelInput(kitLabel?.label || '');
                            }
                        }}
                        autoFocus
                    />
                ) : (
                    <span
                        className="font-bold text-base text-blue-700 dark:text-blue-300 cursor-pointer hover:underline min-w-[2rem]"
                        onClick={() => setEditingKitLabel(true)}
                        title="Edit kit name"
                    >
                        {kitLabel?.label || <span className="italic text-gray-400">(no name)</span>}
                    </span>
                )}
            </div>
            <div className="flex gap-2 mb-3 items-center">
                <button
                    onClick={() => onBack(kitName)}
                    className="px-3 py-1 bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 font-semibold rounded shadow hover:bg-gray-400 dark:hover:bg-slate-600 transition text-xs flex items-center gap-1"
                >
                    <FiArrowLeft />
                    Back
                </button>
                {typeof kitIndex === 'number' && kits && (
                    <>
                        <button
                            className="px-2 py-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                            onClick={onPrevKit}
                            disabled={kitIndex <= 0}
                            title="Previous Kit"
                        >
                            <FiChevronLeft />
                            Previous
                        </button>
                        <button
                            className="px-2 py-1 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                            onClick={onNextKit}
                            disabled={kitIndex >= kits.length - 1}
                            title="Next Kit"
                        >
                            Next
                            <FiChevronRight />
                        </button>
                    </>
                )}
                {labelsLoading ? (
                    <span className="text-xs text-gray-400 self-center">Loading kit metadata...</span>
                ) : labelsError ? (
                    <span className="text-xs text-red-500 self-center">{labelsError}</span>
                ) : null}
            </div>
            <KitMetadataForm
                kitLabel={kitLabel}
                loading={labelsLoading}
                error={labelsError}
                editing={false}
                onEdit={() => {}}
                onCancel={() => {}}
                onSave={(label, _description, tags) => {
                  handleSaveKitLabel(label);
                  handleSaveKitTags(tags);
                }}
                hideDescription={true}
                tagsEditable={true}
            />
            {playbackError && (
                <div className="text-xs text-red-500 mb-2">{playbackError}</div>
            )}
            {/* Scrollable voices section */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="text-sm text-gray-500 dark:text-gray-300">Loading samples...</div>
                ) : error ? (
                    <div className="text-sm text-red-500">{error}</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((voice) => (
                            <KitVoicePanel
                                key={`${kitName}-${voice}`}
                                voice={voice}
                                samples={samples[voice] || []}
                                voiceName={kitLabel?.voiceNames?.[voice] || voiceNames[voice] || null}
                                onSaveVoiceName={handleSaveVoiceName}
                                onRescanVoiceName={handleRescanVoiceName}
                                samplePlaying={samplePlaying}
                                playTriggers={playTriggers}
                                stopTriggers={stopTriggers}
                                onPlay={handlePlay}
                                onStop={handleStop}
                                onWaveformPlayingChange={handleWaveformPlayingChange}
                                sdCardPath={sdCardPath}
                                kitName={kitName}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KitDetails;
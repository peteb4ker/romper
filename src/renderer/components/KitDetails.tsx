import React, { useEffect, useState } from 'react';
import { groupSamplesByVoice, inferVoiceTypeFromFilename, toCapitalCase } from './kitUtils';
import VoiceSamplesList from './VoiceSamplesList';
import SampleWaveform from './SampleWaveform';
import { FiPlay, FiSquare } from 'react-icons/fi';

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
}

interface VoiceSamples {
    [voice: number]: string[];
}

const KitDetails: React.FC<KitDetailsProps> = ({ kitName, sdCardPath, onBack }) => {
    const [samples, setSamples] = useState<VoiceSamples>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState<{ voice: number; sample: string } | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playTriggers, setPlayTriggers] = useState<{ [key: string]: number }>({});
    const [stopTriggers, setStopTriggers] = useState<{ [key: string]: number }>({});
    const [samplePlaying, setSamplePlaying] = useState<{ [key: string]: boolean }>({});
    const [kitLabel, setKitLabel] = useState<RampleKitLabel | null>(null);
    const [labelsLoading, setLabelsLoading] = useState(false);
    const [labelsError, setLabelsError] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState(false);
    const [editLabel, setEditLabel] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editTags, setEditTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [voiceNames, setVoiceNames] = useState<{ [voice: number]: string | null }>({});

    useEffect(() => {
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
        return () => {
            setPlaying(null);
        };
    }, [kitName, sdCardPath]);

    // Play a sample (no pause)
    const handlePlay = (voice: number, sample: string) => {
        // Bump playTrigger for this sample to trigger waveform play
        setPlayTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setPlaying({ voice, sample });
        setPlaybackError(null); // Clear previous error
    };

    const handleStop = (voice: number, sample: string) => {
        setStopTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setSamplePlaying(state => ({ ...state, [voice + ':' + sample]: false }));
    };

    // Listen for playback end and error from backend ONCE on mount
    useEffect(() => {
        // @ts-ignore
        const handleEnded = () => setPlaying(null);
        // @ts-ignore
        const handleError = (errMsg: string) => {
            setPlaying(null);
            setPlaybackError(errMsg || 'Playback failed');
        };
        // @ts-ignore
        window.electronAPI.onSamplePlaybackEnded?.(handleEnded);
        // @ts-ignore
        window.electronAPI.onSamplePlaybackError?.(handleError);
        return () => {
            setPlaying(null);
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
                let needsUpdate = false;
                let updatedVoiceNames: { [voice: number]: string | null } = {};
                if (labels && labels.kits && labels.kits[kitName]) {
                    const kit = labels.kits[kitName];
                    // If voiceNames missing or any are empty/null, infer and update
                    for (let v = 1; v <= 4; v++) {
                        const current = kit.voiceNames?.[v];
                        if (!current) {
                            updatedVoiceNames[v] = voiceNames[v] || null;
                            needsUpdate = true;
                        } else {
                            updatedVoiceNames[v] = current;
                        }
                    }
                    if (needsUpdate) {
                        // Write back updated voiceNames
                        // @ts-ignore
                        const allLabels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
                        allLabels.kits[kitName] = {
                            ...allLabels.kits[kitName],
                            voiceNames: updatedVoiceNames
                        };
                        // @ts-ignore
                        await window.electronAPI.writeRampleLabels(sdCardPath, allLabels);
                        setKitLabel({ ...kit, voiceNames: updatedVoiceNames });
                    } else {
                        setKitLabel(kit);
                    }
                    // Always update edit fields to match saved data when not editing
                    if (!editingLabel) {
                        setEditLabel(kit.label || '');
                        setEditDescription(kit.description || '');
                        setEditTags(kit.tags || []);
                        setTagInput('');
                    }
                } else {
                    setKitLabel(null);
                    if (!editingLabel) {
                        setEditLabel('');
                        setEditDescription('');
                        setEditTags([]);
                        setTagInput('');
                    }
                }
            })
            .catch(e => setLabelsError('Failed to load kit metadata.'))
            .finally(() => setLabelsLoading(false));
    }, [sdCardPath, kitName, editingLabel, voiceNames]);

    const handleEditKitLabel = () => {
        setEditLabel(kitLabel?.label || '');
        setEditDescription(kitLabel?.description || '');
        setEditTags(kitLabel?.tags || []);
        setTagInput('');
        setEditingLabel(true);
    };
    const handleSaveKitLabel = async () => {
        // @ts-ignore
        const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
        const newKitLabel: RampleKitLabel = { label: editLabel };
        if (editDescription.trim() !== '') newKitLabel.description = editDescription.trim();
        if (editTags.length > 0) newKitLabel.tags = editTags;
        labels.kits[kitName] = newKitLabel;
        // @ts-ignore
        await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        setKitLabel(newKitLabel); // Update local state immediately
        setEditingLabel(false);
    };
    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if ((e.key === 'Tab' || e.key === 'Enter') && tagInput.trim()) {
            e.preventDefault();
            if (!editTags.includes(tagInput.trim())) {
                setEditTags([...editTags, tagInput.trim()]);
            }
            setTagInput('');
        } else if (e.key === 'Backspace' && !tagInput && editTags.length > 0) {
            setEditTags(editTags.slice(0, -1));
        }
    };
    const handleRemoveTag = (tag: string) => {
        setEditTags(editTags.filter(t => t !== tag));
    };

    // Write kit metadata to disk on every change while editing
    useEffect(() => {
        if (!editingLabel) return;
        const write = async () => {
            // @ts-ignore
            const labels: RampleLabels = await window.electronAPI.readRampleLabels(sdCardPath) || { kits: {} };
            const newKitLabel: RampleKitLabel = { label: editLabel };
            if (editDescription.trim() !== '') newKitLabel.description = editDescription.trim();
            if (editTags.length > 0) newKitLabel.tags = editTags;
            labels.kits[kitName] = newKitLabel;
            // @ts-ignore
            await window.electronAPI.writeRampleLabels(sdCardPath, labels);
        };
        write();
    }, [editLabel, editDescription, editTags, editingLabel, kitName, sdCardPath]);

    return (
        <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">Kit: {kitName}</h2>
            {/* Header buttons: Back and Add/Edit Metadata side by side */}
            <div className="flex gap-2 mb-3">
                <button
                    onClick={() => onBack(kitName)}
                    className="px-3 py-1 bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 font-semibold rounded shadow hover:bg-gray-400 dark:hover:bg-slate-600 transition text-xs"
                >
                    Back to Kit Browser
                </button>
                {labelsLoading ? (
                    <span className="text-xs text-gray-400 self-center">Loading kit metadata...</span>
                ) : labelsError ? (
                    <span className="text-xs text-red-500 self-center">{labelsError}</span>
                ) : kitLabel && !editingLabel ? (
                    <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs w-fit" onClick={handleEditKitLabel}>Edit Metadata</button>
                ) : !editingLabel ? (
                    <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs w-fit" onClick={handleEditKitLabel}>Add Metadata</button>
                ) : null}
            </div>
            {/* Kit metadata UI */}
            <div className="mb-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-4 flex flex-col gap-3 max-w-xl border border-gray-200 dark:border-slate-700">
                    {editingLabel ? (
                        <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); handleSaveKitLabel(); }}>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold mb-0.5" htmlFor="kit-label">Label</label>
                                <input id="kit-label" className="border rounded px-2 py-1 w-full text-sm" value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold mb-0.5" htmlFor="kit-desc">Description</label>
                                <input id="kit-desc" className="border rounded px-2 py-1 w-full text-sm" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold mb-0.5" htmlFor="kit-tags">Tags</label>
                                <div className="flex flex-wrap items-center gap-1 border rounded px-2 py-1 min-h-[38px] bg-white dark:bg-slate-800 focus-within:ring-2 ring-blue-400">
                                    {editTags.map(tag => (
                                        <span key={tag} className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs flex items-center gap-1 mr-1 mb-1">
                                            {tag}
                                            <button type="button" className="ml-1 text-xs text-blue-700 dark:text-blue-200 hover:text-red-500" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>×</button>
                                        </span>
                                    ))}
                                    <input
                                        className="flex-1 min-w-[60px] border-none outline-none bg-transparent text-xs py-0.5"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleTagInputKeyDown}
                                        placeholder={editTags.length === 0 ? "Add tag..." : ""}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded text-xs">Save</button>
                                <button type="button" className="px-3 py-1 bg-gray-400 text-white rounded text-xs" onClick={() => setEditingLabel(false)}>Cancel</button>
                            </div>
                        </form>
                    ) : kitLabel ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">Label:</span>
                                <span className="font-normal text-xs text-gray-800 dark:text-gray-100">{kitLabel.label}</span>
                            </div>
                            {kitLabel.description && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">Description:</span>
                                    <span className="font-normal text-xs text-gray-800 dark:text-gray-100">{kitLabel.description}</span>
                                </div>
                            )}
                            {kitLabel.tags && kitLabel.tags.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold">Tags:</span>
                                    {kitLabel.tags.map(tag => (
                                        <span key={tag} className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs mr-1 mb-1">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 italic">No metadata for this kit.</div>
                    )}
                </div>
            </div>
            {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-300">Loading samples...</div>
            ) : error ? (
                <div className="text-sm text-red-500">{error}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((voice) => (
                        <div key={voice} className="flex flex-col">
                            <div className="font-semibold mb-1 text-gray-800 dark:text-gray-100 pl-1 flex items-center gap-2">
                                <span>Voice {voice}:</span>
                                { (kitLabel?.voiceNames?.[voice] || voiceNames[voice]) && (
                                    <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-sm font-semibold tracking-wide">
                                        {toCapitalCase(kitLabel?.voiceNames?.[voice] || voiceNames[voice] || '')}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
                                {samples[voice] && samples[voice].length > 0 ? (
                                    <ul className="list-none ml-0 text-sm">
                                        {samples[voice].slice(0, 12).map(sample => {
                                            const sampleKey = voice + ':' + sample;
                                            const isPlaying = samplePlaying[sampleKey];
                                            return (
                                                <li key={sample} className="truncate flex items-center gap-2 mb-1">
                                                    {isPlaying ? (
                                                        <button
                                                            className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs text-red-600 dark:text-red-400`}
                                                            onClick={() => handleStop(voice, sample)}
                                                            aria-label="Stop"
                                                            style={{ minWidth: 24, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <FiSquare />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className={`p-1 rounded hover:bg-blue-100 dark:hover:bg-slate-700 text-xs ${isPlaying ? 'text-green-600 dark:text-green-400' : ''}`}
                                                            onClick={() => handlePlay(voice, sample)}
                                                            aria-label="Play"
                                                            style={{ minWidth: 24, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <FiPlay />
                                                        </button>
                                                    )}
                                                    <span className="truncate text-xs font-mono text-gray-800 dark:text-gray-100" title={sample}>{sample}</span>
                                                    <SampleWaveform
                                                        filePath={`${sdCardPath}/${kitName}/${sample}`}
                                                        playTrigger={playTriggers[sampleKey] || 0}
                                                        stopTrigger={stopTriggers[sampleKey] || 0}
                                                        onPlayingChange={playing => handleWaveformPlayingChange(voice, sample, playing)}
                                                    />
                                                </li>
                                            );
                                        })}
                                        {samples[voice].length > 12 && (
                                            <li className="italic text-xs text-gray-500 dark:text-gray-400">...and more</li>
                                        )}
                                    </ul>
                                ) : (
                                    <div className="text-gray-400 italic text-sm ml-1">No samples assigned</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {playbackError && (
                <div className="text-xs text-red-500 mb-2">{playbackError}</div>
            )}
        </div>
    );
};

export default KitDetails;
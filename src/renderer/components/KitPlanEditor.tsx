// KitPlanEditor: Simple plan editor for assigning samples to voices via drag-and-drop
import React from 'react';
import { FiTrash2 } from 'react-icons/fi';
import type { KitSamplePlanSlot, VoiceSamples } from './kitTypes';

interface KitPlanEditorProps {
    plan: KitSamplePlanSlot[];
    samples: VoiceSamples;
    sdCardPath: string;
    kitName: string;
    onSavePlan: (newPlan: KitSamplePlanSlot[]) => void;
    onCommitPlan: () => void;
    onDiscardPlan: () => void;
    planActionStatus: string | null;
}

// Helper: get plan slots for each voice
export function getPlanVoiceSlots(plan: KitSamplePlanSlot[]) {
    const voices: { [voice: number]: KitSamplePlanSlot[] } = { 1: [], 2: [], 3: [], 4: [] };
    plan.forEach(slot => {
        const v = Number(slot.voice);
        if ([1,2,3,4].includes(v)) voices[v].push(slot);
    });
    return voices;
}

// Helper: get set of duplicate source paths in the plan
function getDuplicateSources(plan: KitSamplePlanSlot[]): Set<string> {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const slot of plan) {
        if (!slot.source) continue;
        if (seen.has(slot.source)) dups.add(slot.source);
        else seen.add(slot.source);
    }
    return dups;
}

const KitPlanEditor: React.FC<KitPlanEditorProps> = ({
    plan,
    samples,
    sdCardPath,
    kitName,
    onSavePlan,
    onCommitPlan,
    onDiscardPlan,
    planActionStatus
}) => {
    // Helper: get plan slots for each voice
    const voices = getPlanVoiceSlots(plan);
    const duplicateSources = getDuplicateSources(plan);

    // Track drag-over state for dropzone highlight
    const [dragOverVoice, setDragOverVoice] = React.useState<number | null>(null);

    // Remove a sample from a voice
    const handleDelete = (voice: number, idx: number) => {
        const newVoiceSlots = voices[voice].filter((_, i) => i !== idx);
        const newPlan = ([] as KitSamplePlanSlot[]).concat(
            ...[1,2,3,4].map(v => v === voice ? newVoiceSlots : voices[v])
        );
        onSavePlan(newPlan);
    };

    // Handle drop: assign sample to a voice (add at end)
    const handleDrop = (voice: number, filePath: string) => {
        // Only accept .wav files
        if (!filePath.toLowerCase().endsWith('.wav')) return;
        const sample = filePath.split('/').pop() || filePath;
        // Prevent duplicate by source path (not just name)
        if (voices[voice].some(slot => slot.source === filePath)) return;
        const newSlot: KitSamplePlanSlot = {
            source: filePath,
            target: sample,
            voice,
        };
        onSavePlan([...plan, newSlot]);
    };

    // Handle reordering within a voice
    const handleReorder = (voice: number, fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx) return;
        const slots = [...voices[voice]];
        const [moved] = slots.splice(fromIdx, 1);
        slots.splice(toIdx, 0, moved);
        const newPlan = ([] as KitSamplePlanSlot[]).concat(
            ...[1,2,3,4].map(v => v === voice ? slots : voices[v])
        );
        onSavePlan(newPlan);
    };

    // Handle file drop event (from OS or browser)
    const handleFileDrop = async (e: React.DragEvent, voice: number) => {
        e.preventDefault();
        setDragOverVoice(null);
        // Handle file drop from OS
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (const file of Array.from(e.dataTransfer.files)) {
                let filePath: string;
                if (window.electronAPI?.getDroppedFilePath) {
                    try {
                        filePath = await window.electronAPI.getDroppedFilePath(file);
                    } catch (err) {
                        console.error('getDroppedFilePath failed:', err);
                        continue;
                    }
                } else {
                    throw new Error('electronAPI.getDroppedFilePath is not available.');
                }
                console.log('Dropped file:', file, 'resolved path:', filePath);
                handleDrop(voice, filePath);
            }
        } else {
            // Handle reordering (plan drag)
            const fromVoice = Number(e.dataTransfer.getData('text/plan-voice'));
            const fromIdx = Number(e.dataTransfer.getData('text/plan-idx'));
            if (!isNaN(fromVoice) && !isNaN(fromIdx) && (fromVoice === voice)) {
                handleReorder(voice, fromIdx, voices[voice].length); // move to end
            }
        }
    };

    return (
        <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900 rounded shadow">
            <div className="font-bold text-yellow-800 dark:text-yellow-200 mb-2">Sample Assignment Plan (Drag .wav files to assign to voices)</div>
            <div className="flex flex-row gap-4">
                {[1,2,3,4].map(voice => (
                    <div key={voice} className="flex-1 flex flex-col bg-gray-100 dark:bg-slate-800 rounded p-2 min-h-[120px]">
                        <div className="font-semibold text-xs mb-1">Voice {voice}</div>
                        <ol className="list-decimal ml-4 min-h-[2rem]">
                            {voices[voice].map((slot, idx) => (
                                <li
                                    key={idx}
                                    className={`flex items-center gap-2 mb-1 draggable-plan-slot ${duplicateSources.has(slot.source) ? 'bg-red-200 dark:bg-red-700 border border-red-500' : ''}`}
                                    draggable
                                    onDragStart={e => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plan-voice', String(voice));
                                        e.dataTransfer.setData('text/plan-idx', String(idx));
                                    }}
                                    onDragOver={e => {
                                        e.preventDefault();
                                        setDragOverVoice(voice);
                                    }}
                                    onDragLeave={e => {
                                        e.preventDefault();
                                        setDragOverVoice(null);
                                    }}
                                    onDrop={e => {
                                        e.preventDefault();
                                        setDragOverVoice(null);
                                        const fromVoice = Number(e.dataTransfer.getData('text/plan-voice'));
                                        const fromIdx = Number(e.dataTransfer.getData('text/plan-idx'));
                                        if (!isNaN(fromVoice) && !isNaN(fromIdx) && (fromVoice === voice)) {
                                            handleReorder(voice, fromIdx, idx);
                                        }
                                    }}
                                    style={{ background: dragOverVoice === voice ? '#e0e7ff' : undefined }}
                                >
                                    <span className="font-mono text-xs text-gray-800 dark:text-gray-100 truncate" title={slot.source}>{slot.target}</span>
                                    <button className="ml-2 text-red-600 dark:text-red-400 text-xs" onClick={() => handleDelete(voice, idx)} title="Remove from voice"><FiTrash2 /></button>
                                </li>
                            ))}
                            {voices[voice].length === 0 && (
                                <li className="italic text-xs text-gray-400">(Empty)</li>
                            )}
                        </ol>
                        <div
                            className={`mt-2 p-1 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded text-xs min-h-[32px] flex items-center justify-center transition-colors ${dragOverVoice === voice ? 'bg-blue-100 dark:bg-blue-900' : 'text-blue-700 dark:text-blue-300'}`}
                            onDragOver={e => { e.preventDefault(); setDragOverVoice(voice); }}
                            onDragLeave={e => { e.preventDefault(); setDragOverVoice(null); }}
                            onDrop={e => handleFileDrop(e, voice)}
                        >
                            Drop .wav file here
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 mt-3">
                <button className="px-2 py-1 bg-green-600 text-white rounded text-xs" onClick={onCommitPlan}>Commit Plan</button>
                <button className="px-2 py-1 bg-gray-400 text-white rounded text-xs" onClick={onDiscardPlan}>Discard Changes</button>
            </div>
            {planActionStatus && (
                <div className="text-xs text-yellow-700 dark:text-yellow-200 mt-2">{planActionStatus}</div>
            )}
        </div>
    );
};

export default KitPlanEditor;

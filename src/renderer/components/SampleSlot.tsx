import React from 'react';

interface SampleSlotProps {
    voice: number;
    sampleName: string | null;
    onAssign: () => void;
    onPlay: () => void;
    onClear: () => void;
}

const SampleSlot: React.FC<SampleSlotProps> = ({ voice, sampleName, onAssign, onPlay, onClear }) => {
    return (
        <div className="p-2 bg-gray-200 dark:bg-slate-800 rounded shadow hover:shadow-md transition flex flex-col space-y-2 text-sm">
            <div className="flex justify-between items-center">
                <span className="font-mono text-cyan-600 dark:text-cyan-400">Voice {voice}</span>
                <span className="text-gray-600 dark:text-gray-400">{sampleName || 'No sample assigned'}</span>
            </div>
            <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded overflow-hidden">
                {/* Placeholder for waveform preview */}
                <div className="h-full bg-gradient-to-r from-cyan-400 to-slate-900"></div>
            </div>
            <div className="flex space-x-2">
                <button
                    onClick={onAssign}
                    className="flex items-center space-x-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-xs"
                >
                    Assign
                </button>
                <button
                    onClick={onPlay}
                    className="flex items-center space-x-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition text-xs"
                >
                    Play
                </button>
                <button
                    onClick={onClear}
                    className="flex items-center space-x-1 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs"
                >
                    Clear
                </button>
            </div>
        </div>
    );
};

export default SampleSlot;
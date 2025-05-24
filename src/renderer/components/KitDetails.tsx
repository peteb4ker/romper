import React, { useEffect, useState } from 'react';
import { groupSamplesByVoice } from './kitUtils';

interface KitDetailsProps {
    kitName: string;
    sdCardPath: string;
    onBack: () => void;
}

interface VoiceSamples {
    [voice: number]: string[];
}

const KitDetails: React.FC<KitDetailsProps> = ({ kitName, sdCardPath, onBack }) => {
    const [samples, setSamples] = useState<VoiceSamples>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            } catch (e: any) {
                setError('Failed to load kit samples.');
            } finally {
                setLoading(false);
            }
        };
        loadSamples();
    }, [kitName, sdCardPath]);

    return (
        <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">Kit: {kitName}</h2>
            <button
                onClick={onBack}
                className="mb-3 px-3 py-1 bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-100 font-semibold rounded shadow hover:bg-gray-400 dark:hover:bg-slate-600 transition text-xs"
            >
                Back to Kit Browser
            </button>
            {loading ? (
                <div className="text-sm text-gray-500 dark:text-gray-300">Loading samples...</div>
            ) : error ? (
                <div className="text-sm text-red-500">{error}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((voice, idx) => (
                        <div key={voice} className="flex flex-col">
                            <div className="font-semibold mb-1 text-gray-800 dark:text-gray-100 pl-1">Voice {voice}:</div>
                            <div className="flex-1 p-3 rounded-lg shadow bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 min-h-[80px]">
                                {samples[voice] && samples[voice].length > 0 ? (
                                    <ul className="list-disc ml-4 text-sm">
                                        {samples[voice].slice(0, 12).map(sample => (
                                            <li key={sample} className="truncate">{sample}</li>
                                        ))}
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
        </div>
    );
};

export default KitDetails;
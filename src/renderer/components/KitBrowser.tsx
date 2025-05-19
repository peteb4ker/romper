import React, { useState, useEffect } from 'react';
import { FiFolder } from 'react-icons/fi';

interface KitBrowserProps {
    sdCardPath: string;
    onSelectKit: (kitName: string) => void;
}

const KitBrowser: React.FC<KitBrowserProps> = ({ sdCardPath, onSelectKit }) => {
    const [kits, setKits] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchKits = async () => {
        try {
            const result = await window.electronAPI.scanSdCard(sdCardPath);
            setKits(result);
        } catch (err) {
            setError('Failed to load kits. Please check the SD card path.');
            console.error(err);
        }
    };

    useEffect(() => {
        fetchKits();

        // Watch for changes in the SD card directory
        const watcher = window.electronAPI.watchSdCard(sdCardPath, () => {
            console.log('Change detected in SD card. Refreshing kits...');
            fetchKits();
        });

        // Cleanup the watcher when the component unmounts
        return () => {
            watcher.close();
        };
    }, [sdCardPath]);

    return (
        <div className="p-4 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">Kit Browser</h3>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {kits.map((kit) => {
                    const isValid = /^[A-Z][0-9]{1,2}$/.test(kit);
                    return (
                        <div
                            key={kit}
                            className={`flex items-center space-x-3 p-3 rounded-lg border ${isValid
                                ? 'border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800'
                                : 'border-red-500 bg-red-100 dark:bg-red-900'
                                } cursor-pointer transition`}
                            onClick={() => isValid && onSelectKit(kit)}
                        >
                            <FiFolder
                                className={`text-2xl ${isValid ? 'text-cyan-500' : 'text-red-500'
                                    }`}
                            />
                            <span
                                className={`font-mono ${isValid
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-red-500'
                                    }`}
                            >
                                {kit}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default KitBrowser;
import React, { useState, useEffect } from 'react';
import { FiFolder } from 'react-icons/fi';

interface KitBrowserProps {
    onSelectKit: (kitName: string) => void;
    sdCardPath: string | null;
    kits?: string[]; // Optional kits prop
}

const KitBrowser: React.FC<KitBrowserProps> = ({ onSelectKit, sdCardPath, kits: externalKits }) => {
    const [kits, setKits] = useState<string[]>(externalKits || []);
    const [error, setError] = useState<string | null>(null);
    const [sdCardWarning, setSdCardWarning] = useState<string | null>(null);

    useEffect(() => {
        if (!externalKits && sdCardPath) {
            const fetchKits = async (path: string) => {
                try {
                    const result = await window.electronAPI.scanSdCard(path);
                    setKits(result);
                } catch (err) {
                    setError('Failed to load kits. Please check the SD card path.');
                }
            };

            fetchKits(sdCardPath);

            const watcher = window.electronAPI.watchSdCard(sdCardPath, () => {
                fetchKits(sdCardPath);
            });

            return () => {
                if (watcher && typeof watcher.close === 'function') {
                    watcher.close();
                }
            };
        }
    }, [sdCardPath, externalKits]);

    const kitsToDisplay = kits.length > 0 ? kits : ['No kits available.'];

    return (
        <div className="p-4 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">Kit Browser</h3>
            {sdCardWarning && <p className="text-yellow-500 mb-4">{sdCardWarning}</p>}
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <button
                onClick={async () => {
                    const selectedPath = await window.electronAPI.selectSdCard();
                    if (selectedPath) {
                        window.electronAPI.setSetting('sdCardPath', selectedPath);
                        setError(null);
                    }
                }}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 transition"
            >
                {sdCardPath ? 'Change SD Card' : 'Select SD Card'}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {kitsToDisplay.map((kit) => {
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
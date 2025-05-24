import React, { useState, useEffect } from 'react';
import KitBrowser from '../components/KitBrowser';
import KitDetails from '../components/KitDetails';
import { useSettings } from '../utils/SettingsContext';

const KitsView = () => {
    const { sdCardPath } = useSettings();
    const [selectedKit, setSelectedKit] = useState<string | null>(null);
    const [kits, setKits] = useState<string[] | null>(null);

    useEffect(() => {
        if (sdCardPath) {
            window.electronAPI.scanSdCard(sdCardPath).then(setKits).catch(() => setKits([]));
        }
    }, [sdCardPath]);

    return (
        <div className="p-3 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 min-h-screen">
            <h2 className="text-lg font-bold mb-3">Kits</h2>
            {sdCardPath ? (
                kits === null ? (
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">Loading kits...</p>
                ) : kits.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">No kits available.</p>
                ) : selectedKit ? (
                    <KitDetails
                        kitName={selectedKit}
                        sdCardPath={sdCardPath}
                        onBack={() => setSelectedKit(null)}
                    />
                ) : (
                    <KitBrowser
                        kits={kits}
                        onSelectKit={setSelectedKit}
                        sdCardPath={sdCardPath}
                    />
                )
            ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                    Please select an SD card to view kits.
                </p>
            )}
        </div>
    );
};

export default KitsView;
import React, { useState } from 'react';
import KitBrowser from '../components/KitBrowser';
import KitDetails from '../components/KitDetails';

const KitsView = () => {
    const [sdCardPath, setSdCardPath] = useState<string | null>(null);
    const [selectedKit, setSelectedKit] = useState<string | null>(null);

    const handleSelectSdCard = async () => {
        try {
            const selectedPath = await window.electronAPI.selectSdCard();
            if (selectedPath) {
                setSdCardPath(selectedPath);
                setSelectedKit(null); // Reset selected kit when SD card changes
            } else {
                console.error('No folder selected.');
            }
        } catch (err) {
            console.error('Failed to select SD card:', err);
        }
    };

    return (
        <div className="p-6 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 min-h-screen">
            <h2 className="text-2xl font-bold mb-6">Kits</h2>
            <button
                onClick={handleSelectSdCard}
                className="mb-6 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600 transition"
            >
                Select SD Card
            </button>
            {sdCardPath ? (
                selectedKit ? (
                    <KitDetails
                        kitName={selectedKit}
                        sdCardPath={sdCardPath}
                        onBack={() => setSelectedKit(null)}
                    />
                ) : (
                    <KitBrowser
                        sdCardPath={sdCardPath}
                        onSelectKit={setSelectedKit}
                    />
                )
            ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center">
                    Please select an SD card to view kits.
                </p>
            )}
        </div>
    );
};

export default KitsView;
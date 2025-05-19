import React from 'react';

interface KitDetailsProps {
    kitName: string;
    sdCardPath: string;
    onBack: () => void;
}

const KitDetails: React.FC<KitDetailsProps> = ({ kitName, sdCardPath, onBack }) => {
    const voiceSlots = [1, 2, 3, 4];

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Kit: {kitName}</h2>
            <button
                onClick={onBack}
                className="mb-6 px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow hover:bg-gray-400 transition"
            >
                Back to Kit Browser
            </button>
            <ul className="space-y-4">
                {voiceSlots.map((slot) => (
                    <li
                        key={slot}
                        className="p-4 bg-gray-100 rounded-lg shadow flex justify-between items-center"
                    >
                        <span className="font-semibold">Voice {slot}:</span>
                        <span className="text-gray-500">No sample assigned</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default KitDetails;
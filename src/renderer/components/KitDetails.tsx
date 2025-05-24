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
            <h2 className="text-base font-bold text-gray-800 mb-2">Kit: {kitName}</h2>
            <button
                onClick={onBack}
                className="mb-3 px-3 py-1 bg-gray-300 text-gray-800 font-semibold rounded shadow hover:bg-gray-400 transition text-xs"
            >
                Back to Kit Browser
            </button>
            <ul className="space-y-2">
                {voiceSlots.map((slot) => (
                    <li
                        key={slot}
                        className="p-2 bg-gray-100 rounded shadow flex justify-between items-center text-sm"
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
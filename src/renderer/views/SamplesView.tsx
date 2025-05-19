import React from 'react';
import SampleSlot from '../components/SampleSlot';

const SamplesView = () => {
    const sampleSlots = [1, 2, 3, 4]; // Placeholder for 4 voice slots

    return (
        <div className="p-6 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 min-h-screen">
            <h2 className="text-2xl font-bold mb-6">Samples</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sampleSlots.map((slot) => (
                    <SampleSlot
                        key={slot}
                        voice={slot}
                        sampleName={null} // Replace with actual sample name
                        onAssign={() => console.log(`Assign sample to Voice ${slot}`)}
                        onPlay={() => console.log(`Play sample on Voice ${slot}`)}
                        onClear={() => console.log(`Clear sample on Voice ${slot}`)}
                    />
                ))}
            </div>
        </div>
    );
};

export default SamplesView;
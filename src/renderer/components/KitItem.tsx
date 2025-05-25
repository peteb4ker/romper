import React from 'react';
import { FiFolder, FiCopy } from 'react-icons/fi';

interface KitItemProps {
    kit: string;
    colorClass: string;
    isValid: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
    sampleCounts?: [number, number, number, number]; // New prop
    kitLabel?: { tags?: string[] };
}

const KitItem: React.FC<KitItemProps & { 'data-kit'?: string }> = ({ kit, colorClass, isValid, onSelect, onDuplicate, sampleCounts, kitLabel, ...rest }) => (
    <div
        className={`flex items-center space-x-2 p-2 rounded border text-sm ${isValid
            ? 'border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800'
            : 'border-red-500 bg-red-100 dark:bg-red-900'
            } cursor-pointer transition`}
        onClick={onSelect}
        {...rest}
    >
        <FiFolder
            className={`text-lg ${colorClass}`}
            aria-label={`Kit bank ${kit[0]}`}
            role="img"
        />
        <span
            className={`font-mono truncate ${isValid
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-red-500'
                }`}
        >
            {kit}
        </span>
        {/* Sample counts for each voice */}
        {isValid && sampleCounts && (
            <span className="flex items-center gap-1 ml-2">
                {sampleCounts.map((count, idx) => {
                    let color = '';
                    let fontWeight = '';
                    if (count === 0) {
                        // Soft rose for 0 samples
                        color = 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800';
                    } else if (count === 12) {
                        // Mid lime for 12 samples, bold
                        color = 'bg-lime-300 dark:bg-lime-700 text-lime-900 dark:text-lime-100 border border-lime-400 dark:border-lime-600';
                        fontWeight = 'font-bold';
                    } else {
                        // Mid teal for 1-11 samples
                        color = 'bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border border-teal-400 dark:border-teal-700';
                    }
                    return (
                        <span
                            key={idx}
                            className={`px-1 rounded text-xs font-mono ${color} ${fontWeight}`}
                            title={`Voice ${idx + 1} samples`}
                        >
                            {count}
                        </span>
                    );
                })}
            </span>
        )}
        {/* Show tags if present, after sample counts */}
        {kitLabel?.tags && kitLabel.tags.length > 0 && (
            <span className="flex flex-wrap gap-1 ml-2">
                {kitLabel.tags.map(tag => (
                    <span key={tag} className="bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100 px-2 py-0.5 rounded-full text-xs">{tag}</span>
                ))}
            </span>
        )}
        {isValid && (
            <button
                className="ml-auto p-1 text-xs text-gray-500 hover:text-green-600"
                title="Duplicate kit"
                onClick={e => { e.stopPropagation(); onDuplicate(); }}
            >
                <FiCopy />
            </button>
        )}
    </div>
);

export default KitItem;

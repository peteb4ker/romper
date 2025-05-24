import React from 'react';
import { FiFolder, FiCopy } from 'react-icons/fi';

interface KitItemProps {
    kit: string;
    colorClass: string;
    isValid: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
}

const KitItem: React.FC<KitItemProps> = ({ kit, colorClass, isValid, onSelect, onDuplicate }) => (
    <div
        className={`flex items-center space-x-2 p-2 rounded border text-sm ${isValid
            ? 'border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800'
            : 'border-red-500 bg-red-100 dark:bg-red-900'
            } cursor-pointer transition`}
        onClick={onSelect}
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

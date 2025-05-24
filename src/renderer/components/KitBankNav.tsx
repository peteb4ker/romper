import React from 'react';

interface KitBankNavProps {
    kits: string[];
    onBankClick: (bank: string) => void;
    bankNames?: Record<string, string>;
}

const KitBankNav: React.FC<KitBankNavProps> = ({ kits, onBankClick, bankNames = {} }) => (
    <div className="overflow-x-auto mb-2">
        <div className="flex gap-1 whitespace-nowrap">
            {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(bank => (
                <button
                    key={bank}
                    className={`px-2 py-1 text-xs rounded font-mono font-semibold transition border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-400
                        ${kits.some(k => k.startsWith(bank))
                            ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 hover:bg-blue-200 dark:hover:bg-blue-800'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'}
                    `}
                    disabled={!kits.some(k => k.startsWith(bank))}
                    onClick={() => onBankClick(bank)}
                    aria-label={`Jump to bank ${bank}`}
                    title={bankNames[bank] ? bankNames[bank] : undefined}
                >
                    {bank}
                </button>
            ))}
        </div>
    </div>
);

export default KitBankNav;

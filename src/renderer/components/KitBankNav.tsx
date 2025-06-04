import React from 'react';

interface KitBankNavProps {
    kits: string[];
    onBankClick: (bank: string) => void;
    bankNames?: Record<string, string>;
    selectedBank?: string;
}

const banks = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const KitBankNav: React.FC<KitBankNavProps> = ({ kits, onBankClick, bankNames = {}, selectedBank }) => (
    <div className="flex flex-row flex-wrap gap-1 justify-center">
        {banks.map(bank => (
            <button
                key={bank}
                className={`px-2 py-1 rounded text-xs font-mono font-bold transition
                    ${selectedBank === bank
                        ? 'bg-blue-800 text-white shadow border border-blue-900'
                        : kits.some(k => k.startsWith(bank))
                            ? 'bg-blue-100 dark:bg-slate-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-slate-600'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'}
                `}
                disabled={!kits.some(k => k.startsWith(bank))}
                onClick={() => onBankClick(bank)}
                aria-label={`Jump to bank ${bank}`}
                title={bankNames[bank] ? bankNames[bank] : undefined}
                aria-current={selectedBank === bank ? 'true' : undefined}
            >
                {bank}
            </button>
        ))}
    </div>
);

export default KitBankNav;

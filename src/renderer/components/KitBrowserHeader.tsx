import React from 'react';

interface KitBrowserHeaderProps {
    onSelectSdCard: () => void;
    onRescanAllVoiceNames: () => void;
    onShowNewKit: () => void;
    onCreateNextKit: () => void;
    nextKitSlot: string | null;
    bankNav?: React.ReactNode;
}

const KitBrowserHeader: React.FC<KitBrowserHeaderProps> = ({
    onSelectSdCard,
    onRescanAllVoiceNames,
    onShowNewKit,
    onCreateNextKit,
    nextKitSlot,
    bankNav,
}) => (
    <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800 pt-2 pr-2 pl-2 pb-0 flex flex-col gap-2 items-stretch justify-between shadow-sm border-b border-gray-200 dark:border-slate-700 mt-0">
        <div className="flex items-center justify-between">
            <div className="flex gap-2">
                <button
                    className="px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-semibold text-xs"
                    onClick={onSelectSdCard}
                >
                    Select SD Card
                </button>
                <button
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded shadow hover:bg-blue-700 font-semibold"
                    onClick={onRescanAllVoiceNames}
                >
                    Rescan All Kit Voice Names
                </button>
            </div>
            <div className="flex gap-2">
                <button
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition font-semibold"
                    onClick={onShowNewKit}
                >
                    + New Kit
                </button>
                <button
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded shadow hover:bg-green-700 transition font-semibold"
                    onClick={onCreateNextKit}
                    disabled={!nextKitSlot}
                >
                    + Next Kit
                </button>
            </div>
        </div>
        {/* BankNav row (A-Z buttons) */}
        {bankNav && (
            <div className="w-full flex justify-center mt-1">
                {bankNav}
            </div>
        )}
    </div>
);

export default KitBrowserHeader;

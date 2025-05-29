import React from 'react';
import KitBrowserHeader from './KitBrowserHeader';
import KitList from './KitList';
import KitDialogs from './KitDialogs';
import KitBankNav from './KitBankNav';
import { useKitBrowser } from './hooks/useKitBrowser';

interface KitBrowserProps {
    onSelectKit: (kitName: string) => void;
    sdCardPath: string | null;
    kits?: string[];
    kitLabels: { [kit: string]: RampleKitLabel };
    onRescanAllVoiceNames: () => void;
    sampleCounts?: Record<string, [number, number, number, number]>;
    onRefreshKits?: () => void;
}

const KitBrowser: React.FC<KitBrowserProps> = (props) => {
    const logic = useKitBrowser(props);
    const {
        kits,
        error,
        sdCardWarning,
        showNewKit,
        setShowNewKit,
        newKitSlot,
        setNewKitSlot,
        newKitError,
        nextKitSlot,
        duplicateKitSource,
        setDuplicateKitSource,
        duplicateKitDest,
        setDuplicateKitDest,
        duplicateKitError,
        bankNames,
        scrollContainerRef,
        handleCreateKit,
        handleCreateNextKit,
        handleDuplicateKit,
        handleBankClick,
        handleSelectSdCard,
    } = logic;

    return (
        <div
            ref={scrollContainerRef}
            className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded m-2"
        >
            <KitBrowserHeader
                onSelectSdCard={handleSelectSdCard}
                onRescanAllVoiceNames={props.onRescanAllVoiceNames}
                onShowNewKit={() => setShowNewKit(true)}
                onCreateNextKit={handleCreateNextKit}
                nextKitSlot={nextKitSlot}
                bankNav={
                    <KitBankNav kits={kits} onBankClick={handleBankClick} bankNames={bankNames} />
                }
            />
            <KitDialogs
                showNewKit={showNewKit}
                newKitSlot={newKitSlot}
                newKitError={newKitError}
                onNewKitSlotChange={setNewKitSlot}
                onCreateKit={handleCreateKit}
                onCancelNewKit={() => { setShowNewKit(false); setNewKitSlot(''); setNewKitError(null); }}
                showDuplicateKit={!!duplicateKitSource}
                duplicateKitSource={duplicateKitSource}
                duplicateKitDest={duplicateKitDest}
                duplicateKitError={duplicateKitError}
                onDuplicateKitDestChange={setDuplicateKitDest}
                onDuplicateKit={handleDuplicateKit}
                onCancelDuplicateKit={() => { setDuplicateKitSource(null); setDuplicateKitDest(''); setDuplicateKitError(null); }}
            />
            {sdCardWarning && <p className="text-yellow-500 mb-2 text-xs">{sdCardWarning}</p>}
            {error && <p className="text-red-500 mb-2 text-xs">{error}</p>}
            <div className="flex-1 min-h-0">
                <KitList
                    kits={kits}
                    onSelectKit={props.onSelectKit}
                    bankNames={bankNames}
                    onDuplicate={kit => { setDuplicateKitSource(kit); setDuplicateKitDest(''); setDuplicateKitError(null); }}
                    sdCardPath={props.sdCardPath || ''}
                    kitLabels={props.kitLabels}
                    sampleCounts={props.sampleCounts}
                />
            </div>
        </div>
    );
};

export default KitBrowser;

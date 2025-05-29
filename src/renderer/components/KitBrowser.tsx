import React, { useState, useEffect } from 'react';
import KitBrowserHeader from './KitBrowserHeader';
import KitList from './KitList';
import KitDialogs from './KitDialogs';
import KitBankNav from './KitBankNav';
import { compareKitSlots, getNextKitSlot, toCapitalCase } from './kitUtils';

interface KitBrowserProps {
    onSelectKit: (kitName: string) => void;
    sdCardPath: string | null;
    kits?: string[];
    kitLabels: { [kit: string]: RampleKitLabel };
    onRescanAllVoiceNames: () => void;
    sampleCounts?: Record<string, [number, number, number, number]>;
    // New: callback to refresh kits after create/duplicate
    onRefreshKits?: () => void;
}

async function getBankNames(sdCardPath: string | null): Promise<Record<string, string>> {
    if (!sdCardPath) return {};
    try {
        const rtfFiles = files.filter(f => /^[A-Z] - .+\.rtf$/i.test(f));
        const bankNames: Record<string, string> = {};
        for (const file of rtfFiles) {
            const match = /^([A-Z]) - (.+)\.rtf$/i.exec(file);
            if (match) {
                const bank = match[1].toUpperCase();
                const name = toCapitalCase(match[2]);
                bankNames[bank] = name;
            }
        }
        return bankNames;
    } catch (e) {}
    return {};
}

const KitBrowser: React.FC<KitBrowserProps> = ({
    onSelectKit,
    sdCardPath,
    kits: externalKits,
    kitLabels,
    onRescanAllVoiceNames,
    sampleCounts,
    onRefreshKits,
}) => {
    // Kits are now always provided by props (from KitsView)
    const kits = externalKits || [];
    const [error, setError] = useState<string | null>(null);
    const [sdCardWarning, setSdCardWarning] = useState<string | null>(null);
    const [showNewKit, setShowNewKit] = useState(false);
    const [newKitSlot, setNewKitSlot] = useState('');
    const [newKitError, setNewKitError] = useState<string | null>(null);
    const [nextKitSlot, setNextKitSlot] = useState<string | null>(null);
    const [duplicateKitSource, setDuplicateKitSource] = useState<string | null>(null);
    const [duplicateKitDest, setDuplicateKitDest] = useState('');
    const [duplicateKitError, setDuplicateKitError] = useState<string | null>(null);
    const [bankNames, setBankNames] = useState<Record<string, string>>({});

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    // Only update nextKitSlot when kits prop changes
    useEffect(() => {
        setNextKitSlot(getNextKitSlot(kits));
    }, [kits]);

    useEffect(() => {
        (async () => {
            const names = await getBankNames(sdCardPath);
            setBankNames(names);
        })();
    }, [sdCardPath]);

    // Dialog handlers
    const handleCreateKit = async () => {
        setNewKitError(null);
        if (!/^[A-Z][0-9]{1,2}$/.test(newKitSlot)) {
            setNewKitError('Invalid kit slot. Use format A0-Z99.');
            return;
        }
        if (!sdCardPath) return;
        try {
            // @ts-ignore
            await window.electronAPI?.createKit?.(sdCardPath, newKitSlot);
            setShowNewKit(false);
            setNewKitSlot('');
            if (onRefreshKits) onRefreshKits(); // Ask KitsView to refresh
        } catch (err: any) {
            setNewKitError('Failed to create kit: ' + (err?.message || err));
        }
    };
    const handleCreateNextKit = async () => {
        setNewKitError(null);
        if (!nextKitSlot || !/^[A-Z][0-9]{1,2}$/.test(nextKitSlot)) {
            setNewKitError('No next kit slot available.');
            return;
        }
        if (!sdCardPath) return;
        try {
            // @ts-ignore
            await window.electronAPI?.createKit?.(sdCardPath, nextKitSlot);
            if (onRefreshKits) onRefreshKits(); // Ask KitsView to refresh
        } catch (err: any) {
            setNewKitError('Failed to create kit: ' + (err?.message || err));
        }
    };
    const handleDuplicateKit = async () => {
        setDuplicateKitError(null);
        if (!duplicateKitSource || !/^[A-Z][0-9]{1,2}$/.test(duplicateKitDest)) {
            setDuplicateKitError('Invalid destination slot. Use format A0-Z99.');
            return;
        }
        if (!sdCardPath) return;
        try {
            // @ts-ignore
            await window.electronAPI?.copyKit?.(sdCardPath, duplicateKitSource, duplicateKitDest);
            setDuplicateKitSource(null);
            setDuplicateKitDest('');
            if (onRefreshKits) onRefreshKits(); // Ask KitsView to refresh
        } catch (err: any) {
            let msg = String(err?.message || err);
            msg = msg.replace(/^Error invoking remote method 'copy-kit':\s*/, '').replace(/^Error:\s*/, '');
            setDuplicateKitError(msg);
        }
    };

    // Navigation handler for banks
    const handleBankClick = (bank: string) => {
        const el = document.getElementById(`bank-${bank}`);
        console.log('handleBankClick', { bank, el });
        if (el && scrollContainerRef.current) {
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
            const containerRect = scrollContainerRef.current.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            // Add 8px offset to match m-2 (Tailwind m-2 = 0.5rem = 8px)
            const offset = elRect.top - containerRect.top - headerHeight - 8;
            console.log('scrolling to', { offset, headerHeight, elRect, containerRect });
            scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollTop + offset, behavior: 'smooth' });
        } else {
            console.warn('Bank element not found for', bank);
        }
    };

    // Move Select SD Card button to the top
    const handleSelectSdCard = async () => {
        const selected = await window.electronAPI.selectSdCard();
        if (selected) {
            window.electronAPI.setSetting('sdCardPath', selected);
        }
    };

    return (
        <div
            ref={scrollContainerRef}
            className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded m-2"
        >
            <KitBrowserHeader
                onSelectSdCard={handleSelectSdCard}
                onRescanAllVoiceNames={onRescanAllVoiceNames}
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
                    onSelectKit={onSelectKit}
                    bankNames={bankNames}
                    onDuplicate={kit => { setDuplicateKitSource(kit); setDuplicateKitDest(''); setDuplicateKitError(null); }}
                    sdCardPath={sdCardPath || ''}
                    kitLabels={kitLabels}
                    sampleCounts={sampleCounts}
                />
            </div>
        </div>
    );
};

export default KitBrowser;

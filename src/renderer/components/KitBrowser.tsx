import React, { useState, useEffect } from 'react';
import KitBankNav from './KitBankNav';
import KitList from './KitList';
import KitDialogs from './KitDialogs';
import { compareKitSlots, getNextKitSlot, toCapitalCase } from './kitUtils';

interface KitBrowserProps {
    onSelectKit: (kitName: string) => void;
    sdCardPath: string | null;
    kits?: string[];
}

// --- PATCH: Add preload API for listing files in SD card root ---
async function listFilesInRoot(sdCardPath: string): Promise<string[]> {
    // Try to use a custom preload API if available
    // @ts-ignore
    if (window.electronAPI && typeof window.electronAPI.listFilesInRoot === 'function') {
        // @ts-ignore
        return await window.electronAPI.listFilesInRoot(sdCardPath);
    }
    return [];
}

async function getBankNames(sdCardPath: string | null): Promise<Record<string, string>> {
    if (!sdCardPath) return {};
    try {
        // @ts-ignore
        const files: string[] = await window.electronAPI?.listFilesInRoot?.(sdCardPath);
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

const KitBrowser: React.FC<KitBrowserProps> = ({ onSelectKit, sdCardPath, kits: externalKits }) => {
    const [kits, setKits] = useState<string[]>(externalKits || []);
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

    useEffect(() => {
        if (!externalKits && sdCardPath) {
            const fetchKits = async (path: string) => {
                // @ts-ignore
                const result = await window.electronAPI?.scanSdCard?.(path);
                setKits(result ?? []);
            };
            fetchKits(sdCardPath);
            // @ts-ignore
            const watcher = window.electronAPI?.watchSdCard?.(sdCardPath, () => {
                fetchKits(sdCardPath);
            });
            return () => {
                if (watcher && typeof watcher.close === 'function') {
                    watcher.close();
                }
            };
        }
    }, [sdCardPath, externalKits]);

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
            // @ts-ignore
            setKits(await window.electronAPI?.scanSdCard?.(sdCardPath) ?? []);
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
            // @ts-ignore
            setKits(await window.electronAPI?.scanSdCard?.(sdCardPath) ?? []);
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
            // @ts-ignore
            setKits(await window.electronAPI?.scanSdCard?.(sdCardPath) ?? []);
        } catch (err: any) {
            let msg = String(err?.message || err);
            msg = msg.replace(/^Error invoking remote method 'copy-kit':\s*/, '').replace(/^Error:\s*/, '');
            setDuplicateKitError(msg);
        }
    };

    // Navigation handler for banks
    const handleBankClick = (bank: string) => {
        const el = document.getElementById(`bank-${bank}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full p-2 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded shadow">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Kits</h3>
                <div className="flex gap-2">
                    <button
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition font-semibold"
                        onClick={() => setShowNewKit(true)}
                    >
                        + New Kit
                    </button>
                    <button
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded shadow hover:bg-green-700 transition font-semibold"
                        onClick={handleCreateNextKit}
                        disabled={!nextKitSlot}
                        title={nextKitSlot ? `Next: ${nextKitSlot}` : 'No slots available'}
                    >
                        + Next Kit
                    </button>
                </div>
            </div>
            <KitBankNav kits={kits} onBankClick={handleBankClick} bankNames={bankNames} />
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
                />
            </div>
        </div>
    );
};

export default KitBrowser;

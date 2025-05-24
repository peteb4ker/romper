import React, { useState, useEffect } from 'react';
import { FiFolder } from 'react-icons/fi';

interface KitBrowserProps {
    onSelectKit: (kitName: string) => void;
    sdCardPath: string | null;
    kits?: string[]; // Optional kits prop
}

// Utility to compare kit slots (e.g. A9 < A10 < B0)
export function compareKitSlots(a: string, b: string): number {
    const bankA = a.charCodeAt(0), numA = parseInt(a.slice(1), 10);
    const bankB = b.charCodeAt(0), numB = parseInt(b.slice(1), 10);
    if (bankA !== bankB) return bankA - bankB;
    return numA - numB;
}

// Utility to get the next kit slot in series
export function getNextKitSlot(existingKits: string[]): string | null {
    if (!existingKits || existingKits.length === 0) return 'A0';
    // Sort kits by bank and number (number as integer, not string)
    const sorted = existingKits
        .filter(k => /^[A-Z][0-9]{1,2}$/.test(k))
        .sort(compareKitSlots);
    const last = sorted[sorted.length - 1];
    let bank = last.charCodeAt(0);
    let num = parseInt(last.slice(1), 10);
    if (num < 99) {
        num++;
    } else if (bank < 'Z'.charCodeAt(0)) {
        bank++;
        num = 0;
    } else {
        return null; // No more slots available
    }
    const next = String.fromCharCode(bank) + num.toString();
    // If next already exists, find the next available
    let tries = 0;
    while (sorted.includes(next) && tries < 2600) {
        if (num < 99) {
            num++;
        } else if (bank < 'Z'.charCodeAt(0)) {
            bank++;
            num = 0;
        } else {
            return null;
        }
        tries++;
    }
    if (tries >= 2600) return null;
    return String.fromCharCode(bank) + num.toString();
}

const KitBrowser: React.FC<KitBrowserProps> = ({ onSelectKit, sdCardPath, kits: externalKits }) => {
    const [kits, setKits] = useState<string[]>(externalKits || []);
    const [error, setError] = useState<string | null>(null);
    const [sdCardWarning, setSdCardWarning] = useState<string | null>(null);
    const [showNewKit, setShowNewKit] = useState(false);
    const [newKitSlot, setNewKitSlot] = useState('');
    const [newKitError, setNewKitError] = useState<string | null>(null);
    const [showNextKit, setShowNextKit] = useState(false);
    const [nextKitSlot, setNextKitSlot] = useState<string | null>(null);

    useEffect(() => {
        if (!externalKits && sdCardPath) {
            const fetchKits = async (path: string) => {
                try {
                    const result = await window.electronAPI.scanSdCard(path);
                    setKits(result);
                } catch (err) {
                    setError('Failed to load kits. Please check the SD card path.');
                }
            };

            fetchKits(sdCardPath);

            const watcher = window.electronAPI.watchSdCard(sdCardPath, () => {
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

    const handleCreateKit = async () => {
        setNewKitError(null);
        if (!/^[A-Z][0-9]{1,2}$/.test(newKitSlot)) {
            setNewKitError('Invalid kit slot. Use format A0-Z99.');
            return;
        }
        if (!sdCardPath) return;
        try {
            await window.electronAPI?.createKit?.(sdCardPath, newKitSlot);
            setShowNewKit(false);
            setNewKitSlot('');
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
            await window.electronAPI?.createKit?.(sdCardPath, nextKitSlot);
            setKits(await window.electronAPI?.scanSdCard?.(sdCardPath) ?? []);
        } catch (err: any) {
            setNewKitError('Failed to create kit: ' + (err?.message || err));
        }
    };

    // Sort kits for display in bank/slot order
    const kitsToDisplay = kits.length > 0
        ? kits.slice().sort(compareKitSlots)
        : ['No kits available.'];

    return (
        <div className="p-2 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded shadow">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Kit Browser</h3>
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
            {showNewKit && (
                <div className="mb-2 flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded">
                    <label className="text-xs font-semibold">Kit Slot (A0-Z99):
                        <input
                            className="ml-2 px-2 py-1 rounded border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                            value={newKitSlot}
                            onChange={e => setNewKitSlot(e.target.value.toUpperCase())}
                            maxLength={3}
                            autoFocus
                        />
                    </label>
                    {newKitError && <div className="text-xs text-red-500">{newKitError}</div>}
                    <div className="flex gap-2">
                        <button
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                            onClick={handleCreateKit}
                        >
                            Create
                        </button>
                        <button
                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 font-semibold"
                            onClick={() => { setShowNewKit(false); setNewKitSlot(''); setNewKitError(null); }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {sdCardWarning && <p className="text-yellow-500 mb-2 text-xs">{sdCardWarning}</p>}
            {error && <p className="text-red-500 mb-2 text-xs">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {kitsToDisplay.map((kit) => {
                    const isValid = /^[A-Z][0-9]{1,2}$/.test(kit);
                    return (
                        <div
                            key={kit}
                            className={`flex items-center space-x-2 p-2 rounded border text-sm ${isValid
                                ? 'border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800'
                                : 'border-red-500 bg-red-100 dark:bg-red-900'
                                } cursor-pointer transition`}
                            onClick={() => isValid && onSelectKit(kit)}
                        >
                            <FiFolder
                                className={`text-lg ${isValid ? 'text-cyan-500' : 'text-red-500'}`}
                            />
                            <span
                                className={`font-mono truncate ${isValid
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-red-500'
                                    }`}
                            >
                                {kit}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default KitBrowser;

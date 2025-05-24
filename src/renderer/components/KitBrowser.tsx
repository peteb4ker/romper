import React, { useState, useEffect } from 'react';
import { FiFolder, FiCopy } from 'react-icons/fi';

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

// Modern, visually distinct color palette for kit banks (A-Z),
// with both light and dark mode and accessible contrast.
const KIT_BANK_COLORS = [
    'text-cyan-700 dark:text-cyan-300',      // 0: A
    'text-pink-700 dark:text-pink-300',      // 1: B
    'text-amber-700 dark:text-amber-300',    // 2: C
    'text-green-700 dark:text-green-300',    // 3: D
    'text-blue-700 dark:text-blue-300',      // 4: E
    'text-purple-700 dark:text-purple-300',  // 5: F
    'text-orange-700 dark:text-orange-300',  // 6: G
    'text-lime-700 dark:text-lime-300',      // 7: H
    'text-fuchsia-700 dark:text-fuchsia-300',// 8: I
    'text-teal-700 dark:text-teal-300',      // 9: J
    'text-rose-700 dark:text-rose-300',      // 10: K
    'text-violet-700 dark:text-violet-300',  // 11: L
];

function getKitColorClass(kit: string): string {
    if (!/^[A-Z]/.test(kit)) return 'text-gray-400 dark:text-gray-500';
    const idx = (kit.charCodeAt(0) - 65) % KIT_BANK_COLORS.length;
    return KIT_BANK_COLORS[idx];
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
    const [duplicateKitSource, setDuplicateKitSource] = useState<string | null>(null);
    const [duplicateKitDest, setDuplicateKitDest] = useState('');
    const [duplicateKitError, setDuplicateKitError] = useState<string | null>(null);

    useEffect(() => {
        if (!externalKits && sdCardPath) {
            const fetchKits = async (path: string) => {
                try {
                    const result = await window.electronAPI?.scanSdCard?.(path);
                    setKits(result ?? []);
                } catch (err) {
                    setError('Failed to load kits. Please check the SD card path.');
                }
            };

            fetchKits(sdCardPath);

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

    const handleDuplicateKit = async () => {
        setDuplicateKitError(null);
        if (!duplicateKitSource || !/^[A-Z][0-9]{1,2}$/.test(duplicateKitDest)) {
            setDuplicateKitError('Invalid destination slot. Use format A0-Z99.');
            return;
        }
        if (!sdCardPath) return;
        try {
            await window.electronAPI?.copyKit?.(sdCardPath, duplicateKitSource, duplicateKitDest);
            setDuplicateKitSource(null);
            setDuplicateKitDest('');
            setKits(await window.electronAPI?.scanSdCard?.(sdCardPath) ?? []);
        } catch (err: any) {
            let msg = String(err?.message || err);
            // Remove verbose Electron IPC error prefix if present
            msg = msg.replace(/^Error invoking remote method 'copy-kit':\s*/, '').replace(/^Error:\s*/, '');
            setDuplicateKitError(msg);
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
            {duplicateKitSource && (
                <div className="mb-2 flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-2 rounded">
                    <label className="text-xs font-semibold">Duplicate {duplicateKitSource} to:
                        <input
                            className="ml-2 px-2 py-1 rounded border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                            value={duplicateKitDest}
                            onChange={e => setDuplicateKitDest(e.target.value.toUpperCase())}
                            maxLength={3}
                            autoFocus
                        />
                    </label>
                    {duplicateKitError && <div className="text-xs text-red-500">{duplicateKitError}</div>}
                    <div className="flex gap-2">
                        <button
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                            onClick={handleDuplicateKit}
                        >
                            Duplicate
                        </button>
                        <button
                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 font-semibold"
                            onClick={() => { setDuplicateKitSource(null); setDuplicateKitDest(''); setDuplicateKitError(null); }}
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
                    const colorClass = isValid ? getKitColorClass(kit) : 'text-red-500';
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
                                    onClick={e => { e.stopPropagation(); setDuplicateKitSource(kit); setDuplicateKitDest(''); setDuplicateKitError(null); }}
                                >
                                    <FiCopy />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

declare global {
    interface Window {
        electronAPI?: {
            scanSdCard?: (sdCardPath: string) => Promise<string[]>;
            selectSdCard?: () => Promise<string | null>;
            watchSdCard?: (sdCardPath: string, callback: () => void) => { close: () => void };
            createKit?: (sdCardPath: string, kitSlot: string) => Promise<void>;
            copyKit?: (sdCardPath: string, sourceKit: string, destKit: string) => Promise<void>;
        };
    }
}

export default KitBrowser;

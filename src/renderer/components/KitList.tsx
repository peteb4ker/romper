import React, { useEffect, useState } from 'react';
import KitItem from './KitItem';
import { compareKitSlots, getKitColorClass, groupSamplesByVoice } from './kitUtils';

interface KitListProps {
    kits: string[];
    onSelectKit: (kit: string) => void;
    bankNames: Record<string, string>;
    onDuplicate: (kit: string) => void;
    sdCardPath: string;
}

type KitSampleCounts = Record<string, [number, number, number, number]>;

const KitList: React.FC<KitListProps> = ({ kits, onSelectKit, bankNames, onDuplicate, sdCardPath }) => {
    const kitsToDisplay = kits.length > 0 ? kits.slice().sort(compareKitSlots) : [];
    const [sampleCounts, setSampleCounts] = useState<KitSampleCounts>({});

    useEffect(() => {
        let cancelled = false;
        const fetchCounts = async () => {
            const counts: KitSampleCounts = {};
            for (const kit of kitsToDisplay) {
                const kitPath = sdCardPath ? `${sdCardPath}/${kit}` : undefined;
                if (!kitPath) continue;
                try {
                    // @ts-ignore
                    const files: string[] = await window.electronAPI?.listFilesInRoot?.(kitPath);
                    const wavs = files.filter(f => /\.wav$/i.test(f));
                    const grouped = groupSamplesByVoice(wavs);
                    counts[kit] = [1,2,3,4].map(v => grouped[v]?.length || 0) as [number, number, number, number];
                } catch {
                    counts[kit] = [0,0,0,0];
                }
            }
            if (!cancelled) setSampleCounts(counts);
        };
        fetchCounts();
        return () => { cancelled = true; };
    }, [kitsToDisplay, sdCardPath]);

    return (
        <div className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded p-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {kitsToDisplay.map((kit, idx, arr) => {
                    const isValid = /^[A-Z][0-9]{1,2}$/.test(kit);
                    const colorClass = isValid ? getKitColorClass(kit) : 'text-red-500';
                    const showBankAnchor = isValid && (idx === 0 || arr[idx - 1][0] !== kit[0]);
                    return (
                        <React.Fragment key={kit}>
                            {showBankAnchor && (
                                <div id={`bank-${kit[0]}`} className="col-span-full mt-2 mb-1 flex items-center gap-2">
                                    <span className="font-bold text-xs tracking-widest text-blue-700 dark:text-blue-300">Bank {kit[0]}</span>
                                    {bankNames[kit[0]] && (
                                        <span className="text-xs text-gray-600 dark:text-gray-300 italic">{bankNames[kit[0]]}</span>
                                    )}
                                </div>
                            )}
                            <KitItem
                                kit={kit}
                                colorClass={colorClass}
                                isValid={isValid}
                                onSelect={() => isValid && onSelectKit(kit)}
                                onDuplicate={() => isValid && onDuplicate(kit)}
                                sampleCounts={sampleCounts[kit]}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default KitList;

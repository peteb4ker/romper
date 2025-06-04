import React from 'react';
import KitItem from './KitItem';
import { useKitListLogic } from './hooks/useKitListLogic';
import { useKitListNavigation } from './hooks/useKitListNavigation';
import type { RampleLabels, RampleKitLabel } from './KitDetails';

interface KitListProps {
    kits: string[];
    onSelectKit: (kit: string) => void;
    bankNames: Record<string, string>;
    onDuplicate: (kit: string) => void;
    sdCardPath: string;
    kitLabels: { [kit: string]: RampleKitLabel };
    sampleCounts?: Record<string, [number, number, number, number]>;
}

const KitList: React.FC<KitListProps> = ({ kits, onSelectKit, bankNames, onDuplicate, sdCardPath, kitLabels, sampleCounts }) => {
    const { kitsToDisplay, isValidKit, getColorClass, showBankAnchor } = useKitListLogic(kits);
    const { focusedIdx, setFocus, moveFocus } = useKitListNavigation(kitsToDisplay);

    const gridCols = 1;
    // Keyboard navigation handler
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === 'Enter' || e.key === ' ') {
            if (kitsToDisplay[focusedIdx]) {
                onSelectKit(kitsToDisplay[focusedIdx]);
                e.preventDefault();
            }
        }
    };

    return (
        <div className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded pt-0 pb-2 pl-2 pr-2"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label="Kit list"
            data-testid="kit-list"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {kitsToDisplay.map((kit, idx, arr) => {
                    const isValid = isValidKit(kit);
                    const colorClass = getColorClass(kit);
                    const showAnchor = showBankAnchor(kit, idx, arr);
                    return (
                        <React.Fragment key={kit}>
                            {showAnchor && (
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
                                sampleCounts={sampleCounts ? sampleCounts[kit] : undefined}
                                kitLabel={kitLabels[kit]}
                                data-kit={kit}
                                tabIndex={focusedIdx === idx ? 0 : -1}
                                aria-selected={focusedIdx === idx}
                                onFocus={() => setFocus(idx)}
                                data-testid={`kit-item-${kit}`}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default KitList;

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { VariableSizeList, ListChildComponentProps } from 'react-window';
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
    voiceLabelSets?: Record<string, string[]>;
    focusedKit?: string | null; // NEW: externally controlled focus
    onBankFocus?: (bank: string) => void; // NEW: notify parent when bank focus changes
}

// Expose imperative scroll/focus API for parent components
export interface KitListHandle {
    scrollAndFocusKitByIndex: (idx: number) => void;
}

const KIT_ROW_HEIGHT = 72; // px
const BANK_ROW_HEIGHT = 100; // px, adjust as needed for anchor+kit
const HEADER_HEIGHT = 5; // px, set to your fixed header height

const KitList = forwardRef<KitListHandle, KitListProps>(({
    kits, onSelectKit, bankNames, onDuplicate, sdCardPath, kitLabels, sampleCounts, voiceLabelSets, focusedKit, onBankFocus
}, ref) => {
    const { kitsToDisplay, isValidKit, getColorClass, showBankAnchor } = useKitListLogic(kits);
    // Only use focusedKit if defined, otherwise undefined
    const navFocusedKit = typeof focusedKit === 'string' ? focusedKit : undefined;
    const { focusedIdx, setFocus, moveFocus } = useKitListNavigation(kitsToDisplay, navFocusedKit);
    const kitRefs = useRef<(HTMLDivElement | null)[]>([]);
    const listRef = useRef<VariableSizeList>(null);

    useEffect(() => {
        if (focusedIdx != null && kitRefs.current[focusedIdx]) {
            kitRefs.current[focusedIdx]?.focus();
        }
    }, [focusedIdx, kitsToDisplay]);

    useEffect(() => {
        if (!navFocusedKit && kitsToDisplay.length > 0) {
            setFocus(0);
        }
    }, [navFocusedKit, kitsToDisplay, setFocus]);

    // Precompute which rows have anchors for height calculation
    const rowHasAnchor = kitsToDisplay.map((kit, idx, arr) => showBankAnchor(kit, idx, arr));

    // Height function for VariableSizeList
    const getItemSize = (index: number) => rowHasAnchor[index] ? BANK_ROW_HEIGHT : KIT_ROW_HEIGHT;

    // Helper to sum row heights up to a given index
    const getOffsetForIndex = (index: number) => {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += getItemSize(i);
        }
        return offset;
    };

    // Shared scroll and focus logic
    const scrollAndFocusKitByIndex = (idx: number) => {
        if (idx < 0 || idx >= kitsToDisplay.length) return;
        if (listRef.current) {
            const offset = getOffsetForIndex(idx) - HEADER_HEIGHT;
            listRef.current.scrollTo(Math.max(0, offset));
            console.log('[KitList] scrollAndFocusKitByIndex', idx, 'offset', offset);
        } else {
            console.warn('[KitList] listRef.current is null');
        }
        setFocus(idx);
    };

    useImperativeHandle(ref, () => ({
        scrollAndFocusKitByIndex
    }), [kitsToDisplay, setFocus]);

    // Track selected kit index for persistent highlight (independent of focus)
    const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

    // Keyboard navigation handler: Support A-Z hotkeys, arrow keys, and Enter
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        // A-Z hotkey: select first kit in bank
        if (e.key.length === 1 && /^[A-Z]$/.test(e.key.toUpperCase())) {
            const bank = e.key.toUpperCase();
            const idx = kitsToDisplay.findIndex(k => k && typeof k === 'string' && k[0] && k[0].toUpperCase() === bank);
            if (idx !== -1) {
                if (typeof onBankFocus === 'function') onBankFocus(bank);
                setSelectedIdx(idx);
                e.preventDefault();
            } else {
                e.preventDefault();
            }
            return;
        }
        // Arrow navigation (up/down/left/right)
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIdx < kitsToDisplay.length - 1) {
                setSelectedIdx(selectedIdx + 1);
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIdx > 0) {
                setSelectedIdx(selectedIdx - 1);
            }
            return;
        }
        // Left/Right: no-op for single column, but included for future grid support
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            return;
        }
        // Enter/Space: select current kit
        if (e.key === 'Enter' || e.key === ' ') {
            const kit = kitsToDisplay[selectedIdx];
            if (isValidKit(kit)) {
                onSelectKit(kit);
                e.preventDefault();
            }
            return;
        }
    };

    // Virtualized row renderer
    const Row = ({ index, style }: ListChildComponentProps) => {
        const kit = kitsToDisplay[index];
        const isValid = isValidKit(kit);
        const colorClass = getColorClass(kit);
        const showAnchor = rowHasAnchor[index];
        const isSelected = selectedIdx === index;
        const kitLabel = kitLabels[kit] || {};
        const dedupedVoiceNames = (voiceLabelSets && voiceLabelSets[kit]) ? { ...kitLabel, voiceNames: voiceLabelSets[kit] } : kitLabel;
        return (
            <div style={style}>
                {showAnchor && (
                    <div id={`bank-${kit[0]}`} className="mt-2 mb-1 flex items-center gap-2">
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
                    onSelect={() => { isValid && onSelectKit(kit); setSelectedIdx(index); }}
                    onDuplicate={() => isValid && onDuplicate(kit)}
                    sampleCounts={sampleCounts ? sampleCounts[kit] : undefined}
                    kitLabel={dedupedVoiceNames}
                    data-kit={kit}
                    data-testid={`kit-item-${kit}`}
                    isSelected={isSelected}
                />
            </div>
        );
    };

    return (
        <div className="h-full min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 rounded pt-0 pb-2 pl-2 pr-2"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label="Kit list"
            data-testid="kit-list"
        >
            <VariableSizeList
                ref={listRef}
                height={600} // or use a prop or container height
                itemCount={kitsToDisplay.length}
                itemSize={getItemSize}
                width="100%"
            >
                {Row}
            </VariableSizeList>
        </div>
    );
});

export default React.memo(KitList);

import React from 'react';
import { FiFolder, FiCopy } from 'react-icons/fi';
import { MdMic, MdAutoAwesome } from 'react-icons/md';
import { BiSolidPiano } from 'react-icons/bi';
import { TiArrowLoop } from 'react-icons/ti';
import { GiDrumKit } from 'react-icons/gi';
import { useKitItem } from './hooks/useKitItem';
import { toCapitalCase } from './kitUtils';

interface KitItemProps {
    kit: string;
    colorClass: string;
    isValid: boolean;
    onSelect: () => void;
    onDuplicate: () => void;
    sampleCounts?: [number, number, number, number]; // New prop
    kitLabel?: { voiceNames?: string[] };
}

// Add ref forwarding to support programmatic focus from KitList
const KitItem = React.memo(React.forwardRef<HTMLDivElement, KitItemProps & { 'data-kit'?: string; isSelected?: boolean }>(
    ({ kit, colorClass, isValid, onSelect, onDuplicate, sampleCounts, kitLabel, isSelected, ...rest }, ref) => {
        const { iconType, iconLabel } = useKitItem(kitLabel?.voiceNames);
        let icon: JSX.Element;
        switch (iconType) {
            case 'mic':
                icon = <MdMic className="text-3xl text-pink-600 dark:text-pink-300" />;
                break;
            case 'loop':
                icon = <TiArrowLoop className="text-3xl text-amber-600 dark:text-amber-300" />;
                break;
            case 'fx':
                icon = <MdAutoAwesome className="text-3xl text-indigo-600 dark:text-indigo-300" />;
                break;
            case 'piano':
                icon = <BiSolidPiano className="text-3xl text-blue-700 dark:text-blue-300" />;
                break;
            case 'drumkit':
                icon = <GiDrumKit className="text-3xl text-yellow-700 dark:text-yellow-300" />;
                break;
            default:
                icon = <FiFolder className="text-3xl" />;
        }
        // Add persistent selection highlight (independent of focus)
        const selectedHighlight = isSelected
            ? 'ring-2 ring-blue-400 dark:ring-blue-300 border-blue-400 dark:border-blue-300 bg-blue-50 dark:bg-blue-900'
            : '';
        // Add data-testid to root element for unambiguous test selection
        return (
            <div
                ref={ref}
                className={`flex flex-col p-2 rounded border text-sm ${isValid
                    ? 'border-gray-300 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-800'
                    : 'border-red-500 bg-red-100 dark:bg-red-900'
                    } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300 ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-300 border-blue-400 dark:border-blue-300 bg-blue-50 dark:bg-blue-900' : ''}`}
                onClick={onSelect}
                data-kit={kit}
                data-testid={`kit-item-${kit}`}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected ? 'true' : 'false'}
                style={{ margin: 0 }}
                {...rest}
            >
                {/* 2-column layout: icon | right content */}
                <div className="flex flex-row w-full h-full items-stretch">
                    {/* Icon column */}
                    <div className="flex items-center justify-center w-auto min-w-0 p-0 m-0 pr-2">
                        <span
                            className="block text-5xl"
                            style={{ lineHeight: 1 }}
                            title={iconLabel}
                        >
                            {icon}
                        </span>
                    </div>
                    {/* Right column: 2 rows */}
                    <div className="flex flex-col flex-1 min-w-0">
                        {/* Top row: kit name, sample counts, copy button */}
                        <div className="flex items-center w-full gap-2">
                            <span
                                className={`font-mono truncate ${isValid
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-red-500'
                                    }`}
                                style={{ flex: 1 }}
                            >
                                {kit}
                            </span>
                            {isValid && sampleCounts && (
                                <span className="flex items-center gap-1 ml-2">
                                    {sampleCounts.map((count, idx) => {
                                        let color = '';
                                        let fontWeight = '';
                                        if (count === 0) {
                                            color = 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800';
                                        } else if (count === 12) {
                                            color = 'bg-lime-300 dark:bg-lime-700 text-lime-900 dark:text-lime-100 border border-lime-400 dark:border-lime-600';
                                            fontWeight = 'font-bold';
                                        } else {
                                            color = 'bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border border-teal-400 dark:border-teal-700';
                                        }
                                        return (
                                            <span
                                                key={idx}
                                                className={`px-1 rounded text-xs font-mono ${color} ${fontWeight}`}
                                                title={`Voice ${idx + 1} samples`}
                                            >
                                                {count}
                                            </span>
                                        );
                                    })}
                                </span>
                            )}
                            {isValid && (
                                <button
                                    className="ml-2 p-1 text-xs text-gray-500 hover:text-green-600"
                                    title="Duplicate kit"
                                    onClick={e => { e.stopPropagation(); onDuplicate(); }}
                                >
                                    <FiCopy />
                                </button>
                            )}
                        </div>
                        {/* Bottom row: voice tags */}
                        {isValid && kitLabel?.voiceNames && (
                            <div className="flex flex-wrap gap-1 mt-1 w-full min-h-[1.5rem] justify-end">
                                {Array.from(new Set(Object.values(kitLabel.voiceNames).filter(Boolean))).map((label, i) => (
                                    <span key={i} className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 px-1 py-0.5 rounded-sm text-[10px] font-mono">
                                        {typeof label === 'string' ? toCapitalCase(label) : label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
));
KitItem.displayName = 'KitItem';
export default KitItem;

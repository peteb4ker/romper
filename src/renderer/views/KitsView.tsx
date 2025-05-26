import React, { useState, useEffect } from 'react';
import KitBrowser from '../components/KitBrowser';
import KitDetails from '../components/KitDetails';
import { useSettings } from '../utils/SettingsContext';
import { compareKitSlots, groupSamplesByVoice } from '../components/kitUtils';

const KitsView = () => {
    const { sdCardPath } = useSettings();
    const [kits, setKits] = useState<string[] | null>(null);
    // Use a single state for selected kit and its samples
    const [selectedKit, setSelectedKit] = useState<string | null>(null);
    const [selectedKitSamples, setSelectedKitSamples] = useState<VoiceSamples | null>(null);

    useEffect(() => {
        if (sdCardPath) {
            window.electronAPI.scanSdCard(sdCardPath).then(setKits).catch(() => setKits([]));
        }
    }, [sdCardPath]);

    useEffect(() => {
        if (!selectedKit || !sdCardPath) {
            setSelectedKitSamples(null);
            return;
        }
        const kitPath = `${sdCardPath}/${selectedKit}`;
        // @ts-ignore
        window.electronAPI?.listFilesInRoot?.(kitPath).then((files: string[]) => {
            const wavFiles = files.filter(f => /\.wav$/i.test(f));
            const voices = groupSamplesByVoice(wavFiles);
            setSelectedKitSamples(voices);
        });
    }, [selectedKit, sdCardPath]);

    // --- PATCH: Always refresh kit list after returning from KitDetails if refresh requested ---
    // Also: restore and fix file watcher for live updates
    useEffect(() => {
        if (!sdCardPath) return;
        let watcher: { close: () => void } | null = null;
        let ignoreNext = false;
        const refresh = async () => {
            const newKits = await window.electronAPI.scanSdCard(sdCardPath).catch(() => []);
            setKits(newKits);
        };
        // Initial load
        refresh();
        // Watch for changes
        watcher = window.electronAPI.watchSdCard(sdCardPath, () => {
            // Prevent double refresh on our own changes
            if (ignoreNext) {
                ignoreNext = false;
                return;
            }
            refresh();
        });
        return () => {
            if (watcher && typeof watcher.close === 'function') {
                watcher.close();
            }
        };
    }, [sdCardPath]);

    // Manual refresh for KitDetails back navigation
    const refreshKits = async () => {
        if (sdCardPath) {
            const newKits = await window.electronAPI.scanSdCard(sdCardPath).catch(() => []);
            setKits(newKits);
            // Prevent watcher from double-refreshing
            // (next watcher event is likely from our own write)
            // This is a workaround for some platforms
            // (if you see double refreshes, this helps debounce)
            // ignoreNext = true;
            return newKits;
        }
        return [];
    };

    const sortedKits = kits ? kits.slice().sort(compareKitSlots) : [];
    const currentKitIndex = sortedKits.findIndex(k => k === selectedKit);
    const handleSelectKit = (kitName: string) => {
        setSelectedKit(kitName);
    };
    const handleNextKit = () => {
        if (sortedKits && currentKitIndex < sortedKits.length - 1) {
            setSelectedKit(sortedKits[currentKitIndex + 1]);
        }
    };
    const handlePrevKit = () => {
        if (sortedKits && currentKitIndex > 0) {
            setSelectedKit(sortedKits[currentKitIndex - 1]);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {selectedKit && selectedKitSamples ? (
                <KitDetails
                    kitName={selectedKit}
                    sdCardPath={sdCardPath}
                    samples={selectedKitSamples}
                    onRequestSamplesReload={async () => {
                        const kitPath = `${sdCardPath}/${selectedKit}`;
                        // @ts-ignore
                        const files: string[] = await window.electronAPI?.listFilesInRoot?.(kitPath);
                        const wavFiles = files.filter(f => /\.wav$/i.test(f));
                        const voices = groupSamplesByVoice(wavFiles);
                        setSelectedKitSamples(voices);
                    }}
                    onBack={async (scrollToKitOrObj) => {
                        let scrollToKit = null;
                        let refresh = false;
                        if (typeof scrollToKitOrObj === 'object' && scrollToKitOrObj !== null) {
                            scrollToKit = scrollToKitOrObj.scrollToKit;
                            refresh = !!scrollToKitOrObj.refresh;
                        } else {
                            scrollToKit = scrollToKitOrObj;
                        }
                        if (refresh) {
                            await refreshKits();
                        }
                        setSelectedKit(null);
                        setSelectedKitSamples(null);
                        if (scrollToKit) {
                            setTimeout(() => {
                                const el = document.querySelector(`[data-kit='${scrollToKit}']`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                        }
                    }}
                    onNextKit={handleNextKit}
                    onPrevKit={handlePrevKit}
                    kits={sortedKits}
                    kitIndex={currentKitIndex}
                />
            ) : (
                <KitBrowser
                    sdCardPath={sdCardPath}
                    kits={sortedKits}
                    onSelectKit={handleSelectKit}
                />
            )}
        </div>
    );
};

export default KitsView;

import React, { useState, useEffect, useCallback } from 'react';
import KitBrowser from '../components/KitBrowser';
import KitDetails from '../components/KitDetails';
import { useSettings } from '../utils/SettingsContext';
import { compareKitSlots, groupSamplesByVoice, inferVoiceTypeFromFilename } from '../components/kitUtils';
import type { VoiceSamples, RampleLabels, RampleKitLabel } from '../components/kitTypes';

const KitsView = () => {
    const { sdCardPath } = useSettings();
    const [kits, setKits] = useState<string[]>([]);
    const [allKitSamples, setAllKitSamples] = useState<{ [kit: string]: VoiceSamples }>({});
    const [kitLabels, setKitLabels] = useState<{ [kit: string]: RampleKitLabel }>({});
    const [selectedKit, setSelectedKit] = useState<string | null>(null);
    const [selectedKitSamples, setSelectedKitSamples] = useState<VoiceSamples | null>(null);

    // Load all kits, samples, and labels on SD card change
    useEffect(() => {
        if (!sdCardPath) return;
        (async () => {
            // 1. Scan all kits
            const kitNames = await window.electronAPI.scanSdCard(sdCardPath).catch(() => []);
            setKits(kitNames);
            // 2. Scan all samples for each kit
            const samples: { [kit: string]: VoiceSamples } = {};
            for (const kit of kitNames) {
                const kitPath = `${sdCardPath}/${kit}`;
                const files = await window.electronAPI.listFilesInRoot(kitPath).catch(() => []);
                const wavs = files.filter((f: string) => /\.wav$/i.test(f));
                samples[kit] = groupSamplesByVoice(wavs);
            }
            setAllKitSamples(samples);
            // 3. Load labels
            const loadedLabels: RampleLabels | null = await window.electronAPI.readRampleLabels(sdCardPath).catch(() => null);
            setKitLabels(loadedLabels && loadedLabels.kits ? loadedLabels.kits : {});
        })();
    }, [sdCardPath]);

    // When a kit is selected, set its samples
    useEffect(() => {
        if (!selectedKit) {
            setSelectedKitSamples(null);
            return;
        }
        setSelectedKitSamples(allKitSamples[selectedKit] || { 1: [], 2: [], 3: [], 4: [] });
    }, [selectedKit, allKitSamples]);

    // Handler: Rescan all kit voice names using in-memory sample lists
    const handleRescanAllVoiceNames = useCallback(async () => {
        if (!sdCardPath) return;
        // Use in-memory allKitSamples
        const newLabels: { [kit: string]: RampleKitLabel } = { ...kitLabels };
        for (const kit of kits) {
            const voices = allKitSamples[kit] || { 1: [], 2: [], 3: [], 4: [] };
            const voiceNames: { [voice: number]: string } = {};
            for (let v = 1; v <= 4; v++) {
                const samples = voices[v] || [];
                let inferred: string | null = null;
                for (const sample of samples) {
                    const type = inferVoiceTypeFromFilename(sample);
                    if (type) { inferred = type; break; }
                }
                voiceNames[v] = inferred || '';
            }
            if (!newLabels[kit]) newLabels[kit] = { label: kit };
            newLabels[kit].voiceNames = voiceNames;
        }
        setKitLabels(newLabels);
        // Write updated labels file
        await window.electronAPI.writeRampleLabels(sdCardPath, { kits: newLabels });
    }, [sdCardPath, kits, allKitSamples, kitLabels]);

    // Compute sample counts for each kit
    const sampleCounts: Record<string, [number, number, number, number]> = {};
    for (const kit of kits) {
        const voices = allKitSamples[kit] || { 1: [], 2: [], 3: [], 4: [] };
        sampleCounts[kit] = [1, 2, 3, 4].map(v => voices[v]?.length || 0) as [number, number, number, number];
    }

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
                    kitLabel={kitLabels[selectedKit]}
                    onRequestSamplesReload={async () => {
                        // Re-scan samples for this kit only
                        const kitPath = `${sdCardPath}/${selectedKit}`;
                        const files: string[] = await window.electronAPI?.listFilesInRoot?.(kitPath).catch(() => []);
                        const wavFiles = files.filter(f => /\.wav$/i.test(f));
                        const voices = groupSamplesByVoice(wavFiles);
                        setAllKitSamples(prev => ({ ...prev, [selectedKit]: voices }));
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
                            // Re-scan all kits and samples
                            if (sdCardPath) {
                                const kitNames = await window.electronAPI.scanSdCard(sdCardPath).catch(() => []);
                                setKits(kitNames);
                                const samples: { [kit: string]: VoiceSamples } = {};
                                for (const kit of kitNames) {
                                    const kitPath = `${sdCardPath}/${kit}`;
                                    const files = await window.electronAPI.listFilesInRoot(kitPath).catch(() => []);
                                    const wavs = files.filter((f: string) => /\.wav$/i.test(f));
                                    samples[kit] = groupSamplesByVoice(wavs);
                                }
                                setAllKitSamples(samples);
                            }
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
                    kitLabels={kitLabels}
                    onRescanAllVoiceNames={handleRescanAllVoiceNames}
                />
            ) : (
                <KitBrowser
                    sdCardPath={sdCardPath}
                    kits={sortedKits}
                    onSelectKit={handleSelectKit}
                    kitLabels={kitLabels}
                    onRescanAllVoiceNames={handleRescanAllVoiceNames}
                    sampleCounts={sampleCounts}
                />
            )}
        </div>
    );
};

export default KitsView;

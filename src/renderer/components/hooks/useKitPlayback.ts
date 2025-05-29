import { useState, useEffect } from 'react';

export function useKitPlayback(samples: any) {
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [playTriggers, setPlayTriggers] = useState<{ [key: string]: number }>({});
    const [stopTriggers, setStopTriggers] = useState<{ [key: string]: number }>({});
    const [samplePlaying, setSamplePlaying] = useState<{ [key: string]: boolean }>({});

    const handlePlay = (voice: number, sample: string) => {
        setPlayTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setPlaybackError(null);
    };
    const handleStop = (voice: number, sample: string) => {
        setStopTriggers(triggers => ({ ...triggers, [voice + ':' + sample]: (triggers[voice + ':' + sample] || 0) + 1 }));
        setSamplePlaying(state => ({ ...state, [voice + ':' + sample]: false }));
    };
    const handleWaveformPlayingChange = (voice: number, sample: string, playing: boolean) => {
        setSamplePlaying(state => ({ ...state, [voice + ':' + sample]: playing }));
    };

    useEffect(() => {
        // @ts-ignore
        const handleEnded = () => {};
        // @ts-ignore
        const handleError = (errMsg: string) => {
            setPlaybackError(errMsg || 'Playback failed');
        };
        // @ts-ignore
        window.electronAPI.onSamplePlaybackEnded?.(handleEnded);
        // @ts-ignore
        window.electronAPI.onSamplePlaybackError?.(handleError);
        return () => {
            // @ts-ignore
            window.electronAPI.onSamplePlaybackEnded?.(() => {});
            // @ts-ignore
            window.electronAPI.onSamplePlaybackError?.(() => {});
        };
    }, []);

    return {
        playbackError,
        playTriggers,
        stopTriggers,
        samplePlaying,
        handlePlay,
        handleStop,
        handleWaveformPlayingChange
    };
}

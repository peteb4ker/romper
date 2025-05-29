const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Ensure the userData directory and settings path are resolved via IPC
const getUserDataPath = async (): Promise<string> => {
    return await ipcRenderer.invoke('get-user-data-path');
};

async function readSettings(): Promise<{ sdCardPath?: string; darkMode?: boolean; theme?: string }> {
    try {
        const settings = await ipcRenderer.invoke('read-settings');
        return typeof settings === 'string' ? JSON.parse(settings) : settings || {};
    } catch (e) {
        console.error('Failed to read settings:', e);
        return {}; // Return an empty object if settings cannot be read
    }
}

async function writeSettings(key: keyof { sdCardPath?: string; darkMode?: boolean; theme?: string }, value: any): Promise<void> {
    try {
        await ipcRenderer.invoke('write-settings', key, value);
    } catch (e) {
        console.error('Failed to write settings:', e);
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    scanSdCard: (sdCardPath: string): Promise<string[]> => ipcRenderer.invoke('scan-sd-card', sdCardPath),
    selectSdCard: (): Promise<string | null> => ipcRenderer.invoke('select-sd-card'),
    watchSdCard: (sdCardPath: string, callback: () => void): { close: () => Promise<void> } => {
        console.log('watchSdCard invoked with path:', sdCardPath);
        ipcRenderer.on('sd-card-changed', (_event: unknown, _data: unknown) => callback());

        return ipcRenderer.invoke('watch-sd-card', sdCardPath).then((watcherId: string) => {
            console.log('watcherId received:', watcherId);
            return {
                close: () => {
                    console.log('Closing watcher with ID:', watcherId);
                    return ipcRenderer.invoke('unwatch-sd-card', watcherId);
                },
            };
        });
    },
    getSetting: async (key: keyof { sdCardPath?: string; darkMode?: boolean; theme?: string }): Promise<any> => {
        const settings = await readSettings();
        return settings[key];
    },
    setSetting: async (key: keyof { sdCardPath?: string; darkMode?: boolean; theme?: string }, value: any): Promise<void> => {
        console.log(`setSetting called with key: ${key}, value:`, value);
        await writeSettings(key, value);
    },
    readSettings: async (): Promise<{ sdCardPath?: string; darkMode?: boolean; theme?: string }> => {
        return readSettings();
    },
    createKit: (sdCardPath: string, kitSlot: string): Promise<void> => ipcRenderer.invoke('create-kit', sdCardPath, kitSlot),
    copyKit: (sdCardPath: string, sourceKit: string, destKit: string): Promise<void> => ipcRenderer.invoke('copy-kit', sdCardPath, sourceKit, destKit),
    listFilesInRoot: (sdCardPath: string): Promise<string[]> => ipcRenderer.invoke('list-files-in-root', sdCardPath),
    playSample: (filePath: string) => ipcRenderer.invoke('play-sample', filePath),
    stopSample: () => ipcRenderer.invoke('stop-sample'),
    onSamplePlaybackEnded: (cb: () => void) => {
        ipcRenderer.removeAllListeners('sample-playback-ended');
        ipcRenderer.on('sample-playback-ended', cb);
    },
    onSamplePlaybackError: (cb: (errMsg: string) => void) => {
        ipcRenderer.removeAllListeners('sample-playback-error');
        ipcRenderer.on('sample-playback-error', (_event: any, errMsg: string) => cb(errMsg));
    },
    readRampleBinAll: (filePath: string) => ipcRenderer.invoke('read-rample-bin-all', filePath),
    getAudioBuffer: (filePath: string) => ipcRenderer.invoke('get-audio-buffer', filePath),
    readRampleLabels: (sdCardPath: string) => ipcRenderer.invoke('read-rample-labels', sdCardPath),
    writeRampleLabels: (sdCardPath: string, labels: any) => ipcRenderer.invoke('write-rample-labels', sdCardPath, labels),
    commitKitPlan: (sdCardPath: string, kitName: string) => ipcRenderer.invoke('commit-kit-plan', sdCardPath, kitName),
    discardKitPlan: (sdCardPath: string, kitName: string) => ipcRenderer.invoke('discard-kit-plan', sdCardPath, kitName),
    rescanAllVoiceNames: (sdCardPath: string, kitNames: string[]) => ipcRenderer.invoke('rescan-all-voice-names', sdCardPath, kitNames),
});

// Expose a function to get the file path from a dropped File object (Electron only)
contextBridge.exposeInMainWorld('electronFileAPI', {
    getDroppedFilePath: async (file: File) => {
        if (webUtils && webUtils.getPathForFile) {
            try {
                return await webUtils.getPathForFile(file);
            } catch (e) {
                console.error('webUtils.getPathForFile failed:', e);
                throw e;
            }
        }
        throw new Error('webUtils.getPathForFile is not available.');
    }
});

console.log('Preload script updated and loaded');
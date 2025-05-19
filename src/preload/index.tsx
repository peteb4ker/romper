const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron').remote || require('@electron/remote');

// Ensure the userData directory is resolved correctly
const userDataPath = app ? app.getPath('userData') : process.env.APPDATA || process.env.HOME;
const settingsPath = path.join(userDataPath, 'settings.json');

function readSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to read settings:', e);
    }
    return {}; // Return an empty object if settings cannot be read
}

function writeSettings(settings: any) {
    try {
        // Ensure the directory exists before writing
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to write settings:', e);
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    scanSdCard: (sdCardPath: string) => ipcRenderer.invoke('scan-sd-card', sdCardPath),
    selectSdCard: () => ipcRenderer.invoke('select-sd-card'),
    watchSdCard: (sdCardPath: string, callback: () => void) => {
        ipcRenderer.on('sd-card-changed', (_: unknown, _data: unknown) => callback());

        return ipcRenderer.invoke('watch-sd-card', sdCardPath).then((watcherId: any) => ({
            close: () => ipcRenderer.invoke('unwatch-sd-card', watcherId),
        }));
    },
    // Settings API
    getSetting: (key: string) => {
        const settings = readSettings();
        return settings[key];
    },
    setSetting: (key: string, value: any) => {
        const settings = readSettings();
        settings[key] = value;
        writeSettings(settings);
    },
});

console.log('Preload script loaded');
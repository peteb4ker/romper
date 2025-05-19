import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watchers: { [key: string]: fs.FSWatcher } = {};

console.log('Preload script path:', path.resolve(__dirname, '../preload/index.js'));

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.resolve(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    win.loadURL('http://localhost:5173').catch((err) => {
        console.error('Failed to load URL:', err);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load preload script:', errorDescription);
    });
}



app.whenReady().then(() => {
    try {
        createWindow();
    } catch (error) {
        console.error('Failed to create window:', error);
    }
});

ipcMain.handle('scan-sd-card', async (event, sdCardPath) => {
    console.log('scan-sd-card handler called with path:', sdCardPath); // Debug log
    try {
        const folders = fs.readdirSync(sdCardPath).filter((folder) => {
            console.log('Found folder:', folder); // Debug log
            return /^[A-Z][0-9]{1,2}$/.test(folder); // Match A0 to Z99
        });
        console.log('Valid folders:', folders); // Debug log
        return folders;
    } catch (error) {
        console.error('Error scanning SD card:', error);
        throw error;
    }
});

ipcMain.handle('select-sd-card', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'], // Allow selecting directories only
        title: 'Select SD Card Path',
    });

    if (result.canceled) {
        return null; // User canceled the dialog
    }

    return result.filePaths[0]; // Return the selected folder path
});

ipcMain.handle('watch-sd-card', (event, sdCardPath: string) => {
    const watcherId = `${sdCardPath}-${Date.now()}`;

    const watcher = fs.watch(sdCardPath, { persistent: true }, (eventType, filename) => {
        if (filename) {
            console.log(`Change detected: ${eventType} on ${filename}`);
            event.sender.send('sd-card-changed', { eventType, filename });
        }
    });

    watchers[watcherId] = watcher;

    return watcherId; // Return the watcher ID to the renderer process
});

ipcMain.handle('unwatch-sd-card', (event, watcherId: string) => {
    if (watchers[watcherId]) {
        watchers[watcherId].close();
        delete watchers[watcherId];
        console.log(`Stopped watching: ${watcherId}`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});
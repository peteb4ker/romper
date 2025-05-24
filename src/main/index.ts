import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watchers: { [key: string]: fs.FSWatcher } = {};
let inMemorySettings: Record<string, any> = {}; // Store settings in memory

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.resolve(__dirname, '../../dist/resources/app-icon.icns'), // Set app icon for built app
        webPreferences: {
            preload: path.resolve(__dirname, '../../dist/preload/index.js'), // Always read from dist folder
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    if (isDev) {
        win.loadURL('http://localhost:5173').catch((err) => {
            console.error('Failed to load URL:', err);
        });
    } else {
        const indexPath = path.resolve(__dirname, '../../dist/renderer/index.html');
        win.loadFile(indexPath).catch((err) => {
            console.error('Failed to load index.html:', err);
        });
    }

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load content:', errorDescription);
    });
}



app.whenReady().then(async () => {
    console.log('App is starting...'); // Early log to confirm execution

    try {
        console.log('App is ready. Configuring...');

        createWindow();

        // Load settings into memory
        const userDataPath = app.getPath('userData');
        const settingsPath = path.join(userDataPath, 'settings.json');

        if (fs.existsSync(settingsPath)) {
            try {
                inMemorySettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
                console.info('Settings loaded from file:', inMemorySettings);

            } catch (error) {
                console.error('Failed to parse settings file. Using empty settings:', error);
            }
        } else {
            console.warn('Settings file not found. Starting with empty settings.');
        }
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});

// Read settings from memory
ipcMain.handle('read-settings', (_event) => {
    return inMemorySettings;
});

// Write settings to memory and persist to file
ipcMain.handle('write-settings', (_event, key: string, value: any) => {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings.json');

    inMemorySettings[key] = value; // Update in-memory settings
    console.log(`Writing setting: ${key} =`, value);

    try {
        fs.writeFileSync(settingsPath, JSON.stringify(inMemorySettings, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to write settings to file:', error);
        throw error;
    }
});

ipcMain.handle('scan-sd-card', async (event, sdCardPath) => {
    try {
        const folders = fs.readdirSync(sdCardPath).filter((folder) => {
            return /^[A-Z][0-9]{1,2}$/.test(folder); // Match A0 to Z99
        });
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

// Get the user data path
ipcMain.handle('get-user-data-path', () => {
    return app.getPath('userData');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});

ipcMain.handle('create-kit', async (_event, sdCardPath: string, kitSlot: string) => {
    // Validate kitSlot
    if (!/^[A-Z][0-9]{1,2}$/.test(kitSlot)) {
        throw new Error('Invalid kit slot. Use format A0-Z99.');
    }
    const kitPath = path.join(sdCardPath, kitSlot);
    if (fs.existsSync(kitPath)) {
        throw new Error('Kit already exists.');
    }
    try {
        fs.mkdirSync(kitPath);
        // Optionally, create a default .KIT file or metadata here
    } catch (err) {
        throw new Error('Failed to create kit folder: ' + err);
    }
});
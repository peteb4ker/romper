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

// Refactor all instances of 'process.env.NODE_ENV === 'development' to use 'isDev'
if (isDev) {
    import('electron-devtools-installer')
        .then((installer) => {
            installer.default(installer.REACT_DEVELOPER_TOOLS)
                .then((name) => console.log(`Added Extension: ${name}`))
                .catch((err) => console.log('An error occurred: ', err));
        })
        .catch((err) => console.log('Failed to load electron-devtools-installer: ', err));
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.resolve(__dirname, '../resources/app-icon.png'),
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

        // Set the dock icon for macOS
        if (process.platform === 'darwin' && app.dock) {
            app.dock.setIcon(path.resolve(__dirname, '../../dist/resources/app-icon.png'));
        }

        createWindow();

        if (isDev) {
            const name = await import('electron-devtools-installer').then((installer) => installer.default(installer.REACT_DEVELOPER_TOOLS));
            console.log(`React DevTools installed: ${name}`);
        }

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
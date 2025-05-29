import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import { registerIpcHandlers } from './ipcHandlers.js';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const watchers: { [key: string]: fs.FSWatcher } = {};
let inMemorySettings: Record<string, any> = {}; // Store settings in memory
let currentSamplePlayer: any = null;
let currentSampleWebContents: Electron.WebContents | null = null;

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

        // Register all IPC handlers
        registerIpcHandlers(watchers, inMemorySettings);
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});
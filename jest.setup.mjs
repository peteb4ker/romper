require('@testing-library/jest-dom');

if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = require('util').TextEncoder;
}

window.electronAPI = {
    ...window.electronAPI,
    readSettings: jest.fn().mockResolvedValue({ sdCardPath: '/mock/path', darkMode: false, theme: 'light' }),
    watchSdCard: jest.fn().mockImplementation((sdCardPath, callback) => {
        console.log(`Mock watchSdCard called with path: ${sdCardPath}`);
        return { close: jest.fn() };
    }),
    getSetting: jest.fn(),
    setSetting: jest.fn(),
    scanSdCard: jest.fn().mockResolvedValue([]), // Added mock for scanSdCard
};

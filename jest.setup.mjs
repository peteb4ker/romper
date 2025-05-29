require('@testing-library/jest-dom');

if (typeof TextEncoder === 'undefined') {
    global.TextEncoder = require('util').TextEncoder;
}

// Mock ElectronAPI and AudioContext for all tests
beforeAll(() => {
  global.window = global.window || {};
  window.electronAPI = {
    listFilesInRoot: async () => ['1sample.wav'],
    readRampleLabels: async () => ({ kits: { TestKit: { label: 'TestKit', voiceNames: {} } } }),
    writeRampleLabels: async () => {},
    getAudioBuffer: async () => new ArrayBuffer(8),
    setSetting: jest.fn(async () => {}),
    getSetting: jest.fn(async () => undefined),
    getDroppedFilePath: async (file) => {
      // Robust: log and return path or name for test visibility
      // Simulate Electron File object with .path property
      if (file && typeof file === 'object' && 'path' in file) {
        return file.path;
      }
      if (file && typeof file === 'object' && 'name' in file) {
        return file.name;
      }
      return '';
    },
    // Add other methods as needed
  };
  // Mock AudioContext for SampleWaveform
  window.AudioContext = function () {
    return {
      decodeAudioData: (arrayBuffer, cb) => cb({}),
      close: () => {},
      state: 'running',
    };
  };
});

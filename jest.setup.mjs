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

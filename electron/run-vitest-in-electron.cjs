const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const vitestPath = path.resolve(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');

const subprocess = spawn(electron, [
  vitestPath,
  'run',
  ...process.argv.slice(2)
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1', // Important: run without Electron GUI
    VITEST_MODE: 'integration', // Set integration mode for dynamic config
  },
});

subprocess.on('exit', (code) => {
  process.exit(code);
});

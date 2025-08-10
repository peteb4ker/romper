#!/usr/bin/env node

// Simple script to verify database using Electron's Node.js runtime
// Usage: node verify-db-with-electron.mjs <db-path>

import { spawn } from "child_process";
import electron from "electron";

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: node verify-db-with-electron.mjs <db-path>");
  process.exit(1);
}

const verifierScript = `
import { verifyDatabase } from './dist/electron/dbVerifier.js';
const dbPath = ${JSON.stringify(dbPath)}; // Properly escape the path
const result = verifyDatabase(dbPath);
console.log(JSON.stringify(result));
`;

const subprocess = spawn(electron, ["-e", verifierScript], {
  stdio: "pipe",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1", // Important: run without Electron GUI
  },
});

let output = "";
subprocess.stdout.on("data", (data) => {
  output += data.toString();
});

subprocess.stderr.on("data", (data) => {
  console.error("stderr:", data.toString());
});

subprocess.on("exit", (code) => {
  if (code === 0) {
    console.log(output.trim());
  } else {
    console.error(`Process exited with code ${code}`);
  }
  process.exit(code);
});

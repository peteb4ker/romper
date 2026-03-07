#!/usr/bin/env node

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Parse .env.local for port configuration
function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      env[key] = value;
    }
  }
  return env;
}

const envLocal = loadEnvLocal();
const vitePort = envLocal.VITE_DEV_SERVER_PORT || "5173";
const inspectPort = envLocal.ELECTRON_INSPECT_PORT || "5858";
const debugPort = envLocal.REMOTE_DEBUG_PORT || "9229";

console.log(`[dev] Ports: vite=${vitePort}, inspector=${inspectPort}, debug=${debugPort}`);

// Step 1: Build all (main, preload, renderer)
console.log("[dev] Building...");
try {
  execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });
} catch {
  console.error("[dev] Build failed");
  process.exit(1);
}

// Step 2: Start Vite dev server and Electron concurrently
const viteArgs = ["dev", "--config", "vite.config.ts", "--port", vitePort];
const vite = spawn("npx", ["vite", ...viteArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env },
});

// Give Vite a moment to start before launching Electron
setTimeout(() => {
  const electronBin = path.join(projectRoot, "node_modules", ".bin", "electron");
  const electronArgs = [
    `--inspect=${inspectPort}`,
    `--remote-debugging-port=${debugPort}`,
    path.join(projectRoot, "dist", "electron", "main", "index.js"),
  ];

  const electron = spawn(electronBin, electronArgs, {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      VITE_DEV_SERVER_PORT: vitePort,
    },
  });

  electron.on("close", (code) => {
    console.log(`[dev] Electron exited with code ${code}`);
    vite.kill();
    process.exit(code ?? 0);
  });
}, 2000);

vite.on("close", (code) => {
  console.log(`[dev] Vite exited with code ${code}`);
  process.exit(code ?? 0);
});

// Forward signals
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    vite.kill(signal);
  });
}

#!/usr/bin/env node

/**
 * Monitor Romper app state via Chrome DevTools Protocol
 */

import WebSocket from "ws";

const WS_URL = "ws://localhost:5858/b842433b-489b-47ca-a678-7b64d18f1d1b";

console.log("🔍 Connecting to Romper main process debugger...");

const ws = new WebSocket(WS_URL);

// Enable runtime and console
ws.on("open", () => {
  console.log("✅ Connected to debugger");

  // Enable Runtime
  ws.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.enable",
    }),
  );

  // Enable Console
  ws.send(
    JSON.stringify({
      id: 2,
      method: "Console.enable",
    }),
  );

  // Evaluate to check migration path
  setTimeout(() => {
    console.log("\n📂 Checking migration path resolution...");
    ws.send(
      JSON.stringify({
        id: 3,
        method: "Runtime.evaluate",
        params: {
          expression: `
          const path = require('path');
          const fs = require('fs');
          const possiblePaths = [
            path.join(__dirname, "..", "migrations"),
            path.join(__dirname, "..", "..", "..", "..", "migrations"),
            path.join(process.cwd(), "electron", "main", "db", "migrations"),
          ];

          let result = { __dirname, cwd: process.cwd(), paths: {} };
          for (const p of possiblePaths) {
            result.paths[p] = fs.existsSync(p);
          }
          result;
        `,
          returnByValue: true,
        },
      }),
    );
  }, 1000);

  // Check for local store status
  setTimeout(() => {
    console.log("\n🏪 Checking local store status...");
    ws.send(
      JSON.stringify({
        id: 4,
        method: "Runtime.evaluate",
        params: {
          expression: `
          const settingsPath = require('path').join(
            require('electron').app.getPath('userData'),
            'romper-settings.json'
          );
          const settings = require('fs').existsSync(settingsPath)
            ? JSON.parse(require('fs').readFileSync(settingsPath, 'utf8'))
            : null;
          { settingsPath, settings };
        `,
          returnByValue: true,
        },
      }),
    );
  }, 2000);
});

// Handle console messages
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());

  if (msg.method === "Console.messageAdded") {
    const { text, level } = msg.params.message;
    if (text.includes("migration") || text.includes("Migration")) {
      console.log(`[${level}] ${text}`);
    }
  }

  if (msg.id === 3 && msg.result) {
    console.log(
      "Migration path check:",
      JSON.stringify(msg.result.result.value, null, 2),
    );
  }

  if (msg.id === 4 && msg.result) {
    console.log(
      "Local store status:",
      JSON.stringify(msg.result.result.value, null, 2),
    );
  }
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
});

ws.on("close", () => {
  console.log("🔌 Debugger connection closed");
});

// Keep script running
process.stdin.resume();

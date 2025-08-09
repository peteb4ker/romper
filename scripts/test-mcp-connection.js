#!/usr/bin/env node

/**
 * Test script to verify MCP access methods for Romper debugging
 * This script tests the Chrome DevTools inspector connection and demonstrates
 * how to access the running Electron main process programmatically.
 */

import { spawn } from "child_process";
import http from "http";

console.log("🔍 Testing MCP Access Methods for Romper");
console.log("==========================================");

/**
 * Test if the Chrome DevTools inspector is accessible
 */
async function testInspectorConnection(port = 5858) {
  console.log(`\n📡 Testing Chrome DevTools Inspector on port ${port}...`);

  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const targets = JSON.parse(data);
          if (targets && targets.length > 0) {
            console.log("✅ Inspector connection successful!");
            console.log(`   Found ${targets.length} debug target(s):`);
            targets.forEach((target, i) => {
              console.log(`   ${i + 1}. ${target.title} (${target.type})`);
              console.log(`      WebSocket: ${target.webSocketDebuggerUrl}`);
              console.log(`      DevTools:  ${target.devtoolsFrontendUrl}`);
            });
            resolve(true);
          } else {
            console.log("⚠️  Inspector accessible but no targets found");
            resolve(false);
          }
        } catch (e) {
          console.log("❌ Inspector response parsing failed:", e.message);
          resolve(false);
        }
      });
    });

    req.on("error", (e) => {
      console.log("❌ Inspector connection failed:", e.message);
      console.log("   Make sure Romper is running with: npm run dev");
      resolve(false);
    });

    req.setTimeout(3000, () => {
      console.log("⏰ Inspector connection timeout - is Romper running?");
      resolve(false);
    });
  });
}

/**
 * Test Playwright MCP server availability
 */
async function testPlaywrightMCP() {
  console.log("\n🎭 Testing Playwright MCP Server...");

  return new Promise((resolve) => {
    const child = spawn("npx", ["@playwright/mcp", "--help"], {
      stdio: "pipe",
    });

    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));

    child.on("close", (code) => {
      if (code === 0 && output.includes("Usage: @playwright/mcp")) {
        console.log("✅ Playwright MCP server is available and working");
        console.log("   To start: npx @playwright/mcp");
        console.log(
          "   Available options include: --browser, --headless, --port, etc.",
        );
        resolve(true);
      } else {
        console.log("❌ Playwright MCP server test failed");
        console.log("Output:", output);
        resolve(false);
      }
    });

    child.on("error", (e) => {
      console.log("❌ Playwright MCP server error:", e.message);
      resolve(false);
    });
  });
}

/**
 * Provide connection instructions
 */
function showConnectionInstructions() {
  console.log("\n📚 Connection Instructions");
  console.log("=========================");

  console.log("\n🔧 Chrome DevTools Main Process Access:");
  console.log("1. Start Romper: npm run dev");
  console.log("2. Open Chrome and go to: chrome://inspect");
  console.log('3. Click "Open dedicated DevTools for Node"');
  console.log("4. Add connection: localhost:5858");
  console.log("5. Switch to Console tab for REPL access");

  console.log("\n🎭 Playwright MCP Server Usage:");
  console.log("1. Start MCP server: npx @playwright/mcp --browser chrome");
  console.log("2. Connect your MCP client to the server");
  console.log("3. Use for UI automation, screenshots, DOM inspection");

  console.log("\n🔍 Renderer Process DevTools:");
  console.log(
    "1. With Romper running, press Cmd+Option+I (Mac) or Ctrl+Shift+I",
  );
  console.log("2. Or add win.webContents.openDevTools() to main process code");

  console.log("\n📖 Full documentation: docs/developer/mcp-access-guide.md");
}

/**
 * Main test function
 */
async function runTests() {
  const inspectorWorking = await testInspectorConnection();
  const playwrightWorking = await testPlaywrightMCP();

  console.log("\n📊 Test Summary");
  console.log("===============");
  console.log(
    `Chrome DevTools Inspector: ${inspectorWorking ? "✅ Ready" : "❌ Not accessible"}`,
  );
  console.log(
    `Playwright MCP Server: ${playwrightWorking ? "✅ Ready" : "❌ Not available"}`,
  );

  if (!inspectorWorking) {
    console.log("\n💡 To enable Inspector access:");
    console.log("   Start Romper with: npm run dev");
    console.log("   The --inspect=5858 flag is already configured");
  }

  showConnectionInstructions();

  return inspectorWorking && playwrightWorking;
}

// Run tests if called directly
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  runTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export { testInspectorConnection, testPlaywrightMCP, runTests };

#!/usr/bin/env node

/**
 * Start Playwright MCP server with optimal settings for Romper debugging
 * This script configures the MCP server for the best debugging experience
 * with the Romper Electron application.
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

console.log("🎭 Starting Playwright MCP Server for Romper");
console.log("===========================================");

// Create output directory for screenshots and traces
const outputDir = join(process.cwd(), "mcp-output");
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Created output directory: ${outputDir}`);
}

// Default MCP server options optimized for Romper
const mcpOptions = [
  // Use Chrome as it matches Electron's browser engine
  "--browser",
  "chrome",

  // Run in headed mode for visual debugging
  // (can be overridden with --headless flag)

  // Set a reasonable viewport size for desktop app testing
  "--viewport-size",
  "1280,800",

  // Save traces for debugging session analysis
  "--save-trace",

  // Save session state for reproducible testing
  "--save-session",

  // Output directory for artifacts
  "--output-dir",
  outputDir,

  // Host configuration for local access
  "--host",
  "localhost",
  "--port",
  "3000",

  // Enable additional capabilities
  "--caps",
  "vision,pdf",

  // Ignore HTTPS errors for local development
  "--ignore-https-errors",

  // Keep isolated profile in memory
  "--isolated",
];

// Allow command line overrides
const args = process.argv.slice(2);
if (args.includes("--headless")) {
  mcpOptions.push("--headless");
  console.log("🕶️  Running in headless mode");
} else {
  console.log("👁️  Running in headed mode (use --headless to run headless)");
}

// Add any additional arguments passed to the script
const additionalArgs = args.filter((arg) => arg !== "--headless");
mcpOptions.push(...additionalArgs);

console.log("\n🔧 Server Configuration:");
console.log(`   Browser: Chrome (matches Electron engine)`);
console.log(`   Viewport: 1280x800 (desktop app optimized)`);
console.log(`   Server: http://localhost:3000`);
console.log(`   Output: ${outputDir}`);
console.log(`   Features: Traces, Sessions, Vision, PDF`);

console.log("\n📡 Starting MCP server...");
console.log("Press Ctrl+C to stop the server\n");

// Start the MCP server
const mcpProcess = spawn("npx", ["@playwright/mcp", ...mcpOptions], {
  stdio: "inherit",
});

// Handle process events
mcpProcess.on("error", (error) => {
  console.error("❌ Failed to start MCP server:", error.message);
  process.exit(1);
});

mcpProcess.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ MCP server stopped gracefully");
  } else {
    console.log(`\n❌ MCP server exited with code ${code}`);
  }
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping MCP server...");
  mcpProcess.kill("SIGINT");
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Stopping MCP server...");
  mcpProcess.kill("SIGTERM");
});

// Display connection instructions
setTimeout(() => {
  console.log("\n📚 Connection Instructions:");
  console.log("==========================");
  console.log("1. Server is running at: http://localhost:3000");
  console.log("2. Connect your MCP client to this server");
  console.log("3. For Claude Code integration, use MCP client tools");
  console.log("4. Screenshots and traces will be saved to:", outputDir);
  console.log("\n💡 To test with a running Romper instance:");
  console.log("   1. Start Romper: npm run dev (in another terminal)");
  console.log("   2. Use MCP client to connect to the Electron app");
  console.log("   3. Navigate to local file:// URLs or localhost ports");
}, 2000);

const { spawn } = require("child_process");
const electron = require("electron");
const path = require("path");
const fs = require("fs");

// Find the playwright executable
let playwrightPath;
const possiblePaths = [
  path.resolve(
    __dirname,
    "..",
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  ),
  path.resolve(__dirname, "..", "node_modules", "playwright", "cli.js"),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    playwrightPath = p;
    break;
  }
}

if (!playwrightPath) {
  console.error("Could not find Playwright CLI");
  process.exit(1);
}

const subprocess = spawn(
  electron,
  [playwrightPath, "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1", // Important: run without Electron GUI
      PLAYWRIGHT_ELECTRON_NODE: "1", // Flag to indicate we're running in Electron Node
    },
  },
);

subprocess.on("exit", (code) => {
  process.exit(code);
});

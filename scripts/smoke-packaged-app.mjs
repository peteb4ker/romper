#!/usr/bin/env node
/**
 * Launch a packaged Romper build and wait for it to start its updater
 * (RE-16, RE-17). Unit and e2e tests run the unpackaged app, where the
 * updater is skipped, so only a packaged run shows it loads.
 *
 *   node scripts/smoke-packaged-app.mjs <path to the app's executable>
 *
 * The app runs hidden against a copy of the e2e fixture store and an empty
 * folder as its SD card. Exits 0 once the app logs that auto-update is
 * initialised; 1 if it logs a failure, exits, or takes too long.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const READY = "[AutoUpdate] Initialised (macOS, packaged)";
const FAILED = "[AutoUpdate] Failed to initialise";
const TIMEOUT_MS = 90_000;

const executable = process.argv[2];
if (!executable || !fs.existsSync(executable)) {
  console.error(
    `Usage: smoke-packaged-app.mjs <executable> (got ${executable})`,
  );
  process.exit(1);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "romper-smoke-"));
const store = path.join(root, "store");
const card = path.join(root, "card");
fs.mkdirSync(store);
fs.mkdirSync(card);
await run("tar", [
  "-xzf",
  path.resolve("tests/fixtures/e2e/local-store-fixture.tar.gz"),
  "-C",
  store,
]);

const app = spawn(executable, [], {
  env: {
    ...process.env,
    ROMPER_HEADLESS: "true",
    ROMPER_LOCAL_PATH: store,
    ROMPER_SDCARD_PATH: card,
    ROMPER_TEST_MODE: "true",
  },
});

const log = [];
const result = await new Promise((resolve) => {
  const timer = setTimeout(
    () => resolve(`timed out after ${TIMEOUT_MS / 1000}s`),
    TIMEOUT_MS,
  );
  const onData = (chunk) => {
    const text = chunk.toString();
    log.push(text);
    if (text.includes(READY)) {
      clearTimeout(timer);
      resolve(null);
    } else if (text.includes(FAILED)) {
      clearTimeout(timer);
      resolve("the updater failed to initialise");
    }
  };
  app.stdout.on("data", onData);
  app.stderr.on("data", onData);
  app.on("exit", (code) => {
    clearTimeout(timer);
    resolve(`the app exited (code ${code}) before starting its updater`);
  });
});

app.kill();
fs.rmSync(root, { force: true, recursive: true });

if (result) {
  console.error(log.join(""));
  console.error(`Packaged app smoke test failed: ${result}`);
  process.exit(1);
}
console.log(`Packaged app started and logged: ${READY}`);
// The killed app's handles would otherwise keep the script alive
process.exit(0);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

#!/usr/bin/env node
/**
 * Launch a packaged Romper build and wait for it to start its updater
 * (RE-16, RE-17). Unit and e2e tests run the unpackaged app, where the
 * updater is skipped, so only a packaged run shows it loads.
 *
 *   node scripts/smoke-packaged-app.mjs <path to the app's executable>
 *
 * The app runs hidden against a copy of the e2e fixture store, an empty
 * folder as its SD card and its own settings folder, all in one temp folder
 * that's removed afterwards. Exits 0 once the app logs that auto-update is
 * initialised; 1 if it logs a failure, exits, or takes too long.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const READY = "[AutoUpdate] Initialised (macOS, packaged)";
const FAILED = "[AutoUpdate] Failed to initialise";
const TIMEOUT_MS = 90_000;

/**
 * The environment the app runs with: everything it writes goes under
 * `root`. Without ROMPER_USER_DATA_DIR the app, named "Romper", would read
 * and write the installed app's settings (#626), so it's always set here,
 * even when the caller's environment already has one.
 * @param {NodeJS.ProcessEnv} baseEnv the caller's environment
 * @param {string} root the run's temp folder
 */
export function smokeEnv(baseEnv, root) {
  return {
    ...baseEnv,
    ROMPER_HEADLESS: "true",
    ROMPER_LOCAL_PATH: path.join(root, "store"),
    ROMPER_SDCARD_PATH: path.join(root, "card"),
    ROMPER_TEST_MODE: "true",
    ROMPER_USER_DATA_DIR: path.join(root, "user-data"),
  };
}

async function main(executable) {
  if (!executable || !fs.existsSync(executable)) {
    console.error(
      `Usage: smoke-packaged-app.mjs <executable> (got ${executable})`,
    );
    return 1;
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "romper-smoke-"));
  try {
    const env = smokeEnv(process.env, root);
    for (const dir of [
      env.ROMPER_LOCAL_PATH,
      env.ROMPER_SDCARD_PATH,
      env.ROMPER_USER_DATA_DIR,
    ]) {
      fs.mkdirSync(dir);
    }
    await run("tar", [
      "-xzf",
      path.resolve("tests/fixtures/e2e/local-store-fixture.tar.gz"),
      "-C",
      env.ROMPER_LOCAL_PATH,
    ]);

    const { log, result } = await waitForUpdater(
      spawn(executable, [], { env }),
    );
    if (result) {
      console.error(log.join(""));
      console.error(`Packaged app smoke test failed: ${result}`);
      return 1;
    }
    console.log(`Packaged app started and logged: ${READY}`);
    return 0;
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

/** Resolves once the app logs its updater's state, exits, or times out; then stops it. */
async function waitForUpdater(app) {
  const log = [];
  let exited = false;
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
      exited = true;
      clearTimeout(timer);
      resolve(`the app exited (code ${code}) before starting its updater`);
    });
  });

  // Wait for the app to quit before its temp folder is removed, so it isn't
  // still writing settings there
  if (!exited) {
    const quit = new Promise((resolve) => app.once("exit", resolve));
    app.kill();
    const force = setTimeout(() => app.kill("SIGKILL"), 10_000);
    await quit;
    clearTimeout(force);
  }
  return { log, result };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const code = await main(process.argv[2]);
  // The killed app's handles would otherwise keep the script alive
  process.exit(code);
}

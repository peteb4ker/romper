#!/usr/bin/env node
/**
 * Run the full-pipeline validation against the built app.
 *
 *   npm run validate:full                 # local copy of the factory archive
 *   npm run validate:full -- --fresh      # download it from Squarp first
 *   npm run validate:full -- --headed     # show the window
 *   npm run validate:full -- --keep       # keep the temp store and card
 *   npm run validate:full -- --no-build   # reuse the existing build
 *
 * The report goes to validation-report/report.md.
 */
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const known = new Set(["--fresh", "--headed", "--keep", "--no-build"]);
for (const arg of args) {
  if (!known.has(arg)) {
    console.error(`Unknown option ${arg}. Options: ${[...known].join(", ")}`);
    process.exit(2);
  }
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (cmd, cmdArgs, env = {}) => {
  const result = spawnSync(cmd, cmdArgs, {
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  return result.status ?? 1;
};

if (!args.has("--no-build")) {
  const status = run(npm, ["run", "build"]);
  if (status !== 0) process.exit(status);
}

process.exit(
  run(npx, ["playwright", "test", "--config", "playwright.validation.config.ts"], {
    ROMPER_HEADLESS: args.has("--headed") ? "false" : "true",
    ROMPER_VALIDATE_FRESH: args.has("--fresh") ? "true" : "false",
    ROMPER_VALIDATE_KEEP: args.has("--keep") ? "true" : "false",
  }),
);

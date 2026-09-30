#!/usr/bin/env node
// Screenshot (and optionally probe) the renderer of a running `npm run dev`
// Electron app over the Chrome DevTools Protocol.
//
// Usage:
//   node scripts/dev-screenshot.mjs [--out <file.png>] [--selector <css>]
//                                   [--eval <js-expression>] [--port <n>]
//
// The debug port defaults to REMOTE_DEBUG_PORT from .env.local (written per
// worktree by worktree:create), falling back to 9229 like scripts/dev.js.
// Output defaults to test-results/dev-screenshot.png (gitignored).

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function envLocalPort() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) return undefined;
  const match = fs.readFileSync(envPath, "utf8").match(/^REMOTE_DEBUG_PORT=(\d+)/m);
  return match?.[1];
}

const port = arg("port") ?? envLocalPort() ?? "9229";
const out = path.resolve(arg("out") ?? path.join(projectRoot, "test-results", "dev-screenshot.png"));
const selector = arg("selector");
const expression = arg("eval");

let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
} catch (error) {
  console.error(
    `Could not connect to CDP on port ${port}. Is \`npm run dev\` running from this worktree?\n${error.message}`,
  );
  process.exit(1);
}

try {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((p) => !p.url().startsWith("devtools://"));
  if (!page) throw new Error(`No renderer page found (pages: ${pages.map((p) => p.url()).join(", ")})`);

  if (expression) {
    const result = await page.evaluate(expression);
    console.log(JSON.stringify(result, null, 2));
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (selector) {
    await page.locator(selector).first().screenshot({ path: out });
  } else {
    await page.screenshot({ path: out });
  }
  console.log(`Saved ${path.relative(process.cwd(), out)} (${page.url()})`);
} finally {
  // Disconnect only; closing a CDP-connected browser would quit the app.
  await browser.close().catch(() => {});
}

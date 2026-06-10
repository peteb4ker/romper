import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enforces parity across the three IPC layers so a channel cannot silently
 * drift out of alignment:
 *
 *   - every `ipcRenderer.invoke("x")` in the preload has a matching
 *     `ipcMain.handle("x")` in the main process (else the call rejects at
 *     runtime with "No handler registered" — see the play-sample/stop-sample
 *     dead channels removed in #296);
 *   - every `ipcMain.handle("x")` is actually invoked by the preload (else
 *     it is an orphan handler — like update-sample-metadata and
 *     delete-all-samples-for-kit, both shipped and later removed).
 *
 * Static source scan rather than a runtime harness: it needs no Electron and
 * catches the drift at the same layer the bug lives in.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MAIN_DIR = path.join(REPO_ROOT, "electron", "main");
const PRELOAD_DIR = path.join(REPO_ROOT, "electron", "preload");

// Channels intentionally registered but not invoked from the preload bridge
// (e.g. main-to-main or future-reserved). Keep empty; add with a comment and
// a reason if a legitimate case ever arises.
const ALLOWED_UNINVOKED: ReadonlySet<string> = new Set<string>();

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (/\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Match `<call>(` followed by optional whitespace/newlines then a string
// literal, so multi-line registrations (ipcMain.handle(\n  "x",) are caught.
function extractChannels(files: string[], call: string): Set<string> {
  const pattern = new RegExp(
    call.replace(".", "\\.") + String.raw`\(\s*["']([^"']+)["']`,
    "g",
  );
  const channels = new Set<string>();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf-8");
    for (const match of source.matchAll(pattern)) {
      channels.add(match[1]);
    }
  }
  return channels;
}

describe("IPC channel parity", () => {
  const registered = extractChannels(
    collectTsFiles(MAIN_DIR),
    "ipcMain.handle",
  );
  const invoked = extractChannels(
    collectTsFiles(PRELOAD_DIR),
    "ipcRenderer.invoke",
  );

  it("found a meaningful number of channels (scan sanity check)", () => {
    expect(registered.size).toBeGreaterThan(30);
    expect(invoked.size).toBeGreaterThan(30);
  });

  it("every preload-invoked channel is registered in main", () => {
    const missing = [...invoked].filter((c) => !registered.has(c)).sort();
    expect(
      missing,
      `Preload invokes channels with no ipcMain.handle (calls would reject):\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every registered channel is invoked by the preload (no orphans)", () => {
    const orphans = [...registered]
      .filter((c) => !invoked.has(c) && !ALLOWED_UNINVOKED.has(c))
      .sort();
    expect(
      orphans,
      `Main registers handlers nothing invokes (orphans):\n  ${orphans.join("\n  ")}`,
    ).toEqual([]);
  });
});

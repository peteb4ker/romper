import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards against vi.mock() calls whose module specifier does not resolve.
 *
 * vi.mock with a path that matches nothing is silently ignored: the real
 * module runs and the test verifies less than it appears to. A directory
 * restructure introduced thirteen of these at once (see PR for the list),
 * one of which pulled the real `electron` module into the unit suite.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOTS = ["app", "electron", "shared", "tests"];

// Resolution candidates for a TS/ESM specifier (a mock of "./x.js" must
// match the on-disk ./x.ts the same way the import does)
const CANDIDATE_SUFFIXES = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
];

function collectTestFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "worktrees") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(full, out);
    } else if (/\.test\.(t|j)sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
}

function resolvesToFile(specifier: string, fromFile: string): boolean {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const stripped = base.replace(/\.(js|jsx)$/, "");
  for (const root of [base, stripped]) {
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = root + suffix;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return true;
      }
    }
  }
  return false;
}

describe("vi.mock path resolution", () => {
  it("every relative vi.mock specifier resolves to a real module", () => {
    const testFiles: string[] = [];
    for (const root of SCAN_ROOTS) {
      const dir = path.join(REPO_ROOT, root);
      if (fs.existsSync(dir)) collectTestFiles(dir, testFiles);
    }
    expect(testFiles.length).toBeGreaterThan(100);

    const failures: string[] = [];
    const mockPattern = /vi\.(mock|doMock)\(\s*["']([^"']+)["']/g;

    for (const file of testFiles) {
      const source = fs.readFileSync(file, "utf-8");
      for (const match of source.matchAll(mockPattern)) {
        const specifier = match[2];
        if (!specifier.startsWith(".")) continue; // bare specifiers = packages
        if (!resolvesToFile(specifier, file)) {
          failures.push(
            `${path.relative(REPO_ROOT, file)} mocks "${specifier}" which resolves to nothing — the real module will run`,
          );
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });
});

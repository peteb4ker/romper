// Folders a test file's helpers make once and keep for the whole file (the
// template database in storeDb.ts). The integration setup file (setup.ts)
// deletes them after the file's last test. It runs in the test file's own
// module graph, so it sees the folders that file's helpers registered.
import fs from "node:fs";

const dirs = new Set<string>();

/** Register a folder to delete after the current test file's last test */
export function registerTempDir(dir: string): void {
  dirs.add(dir);
}

/** Delete every registered folder; setup.ts runs this in afterAll */
export function removeRegisteredTempDirs(): void {
  for (const dir of dirs) {
    fs.rmSync(dir, { force: true, maxRetries: 5, recursive: true });
  }
  dirs.clear();
}

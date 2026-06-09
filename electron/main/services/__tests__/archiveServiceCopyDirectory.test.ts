import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArchiveService } from "../archiveService";

// Real-filesystem tests for copyDirectory's symlink handling. These do not mock
// node:fs (unlike archiveService.test.ts), so they exercise the actual copy.
describe("ArchiveService.copyDirectory symlink handling", () => {
  let tmpRoot: string;
  const service = new ArchiveService();

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-copydir-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  it("copies regular files and nested directories", () => {
    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(path.join(src, "nested"), { recursive: true });
    fs.writeFileSync(path.join(src, "a.wav"), "a");
    fs.writeFileSync(path.join(src, "nested", "b.wav"), "b");

    const dest = path.join(tmpRoot, "dest");
    const result = service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(dest, "a.wav"), "utf-8")).toBe("a");
    expect(fs.readFileSync(path.join(dest, "nested", "b.wav"), "utf-8")).toBe(
      "b",
    );
  });

  it("skips symlinks instead of following them", () => {
    // A sensitive file outside the source tree.
    const secret = path.join(tmpRoot, "secret.txt");
    fs.writeFileSync(secret, "top secret");

    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, "real.wav"), "real");
    // A planted symlink pointing at the sensitive file.
    fs.symlinkSync(secret, path.join(src, "link.txt"));

    const dest = path.join(tmpRoot, "dest");
    const result = service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    // The real file is copied...
    expect(fs.readFileSync(path.join(dest, "real.wav"), "utf-8")).toBe("real");
    // ...but the symlink is not, so the secret content never lands in dest.
    expect(fs.existsSync(path.join(dest, "link.txt"))).toBe(false);
  });

  it("skips a symlinked subdirectory", () => {
    const outsideDir = path.join(tmpRoot, "outside");
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "leak.txt"), "leak");

    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.symlinkSync(outsideDir, path.join(src, "linkdir"));

    const dest = path.join(tmpRoot, "dest");
    const result = service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(dest, "linkdir"))).toBe(false);
  });
});

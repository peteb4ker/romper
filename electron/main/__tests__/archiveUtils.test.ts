import AdmZip from "adm-zip";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type ArchiveLimits,
  countZipEntries,
  DEFAULT_ARCHIVE_LIMITS,
  extractZipEntries,
  isValidEntry,
  isWithinDirectory,
} from "../archiveUtils";

describe("isValidEntry", () => {
  it("returns false for __MACOSX/ entries", () => {
    expect(isValidEntry("__MACOSX/._foo.wav")).toBe(false);
    expect(isValidEntry("__MACOSX/foo.wav")).toBe(false);
    expect(isValidEntry("foo/__MACOSX/bar.wav")).toBe(false);
  });

  it("returns false for dot-underscore files anywhere in path", () => {
    expect(isValidEntry("._foo.wav")).toBe(false);
    expect(isValidEntry("foo/._bar.wav")).toBe(false);
    expect(isValidEntry("foo/bar/._baz.wav")).toBe(false);
  });

  it("returns true for normal files and directories", () => {
    expect(isValidEntry("foo.wav")).toBe(true);
    expect(isValidEntry("foo/bar.wav")).toBe(true);
    expect(isValidEntry("foo/bar/baz.wav")).toBe(true);
    expect(isValidEntry("folder/normalfile.txt")).toBe(true);
  });

  it("rejects parent-directory traversal (Zip-Slip)", () => {
    expect(isValidEntry("../foo.wav")).toBe(false);
    expect(isValidEntry("../../etc/passwd")).toBe(false);
    expect(isValidEntry("foo/../../bar.wav")).toBe(false);
    expect(isValidEntry("foo/../bar.wav")).toBe(false);
    // Backslash-separated traversal (Windows-style entries)
    expect(isValidEntry("..\\foo.wav")).toBe(false);
    expect(isValidEntry("foo\\..\\..\\bar.wav")).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(isValidEntry("/etc/passwd")).toBe(false);
    expect(isValidEntry("C:\\Windows\\system32\\evil.dll")).toBe(false);
  });

  it("rejects empty paths", () => {
    expect(isValidEntry("")).toBe(false);
  });
});

describe("isWithinDirectory", () => {
  it("accepts entries that resolve inside the destination", () => {
    expect(isWithinDirectory("/tmp/dest", "foo.wav")).toBe(true);
    expect(isWithinDirectory("/tmp/dest", "a/b/c.wav")).toBe(true);
    expect(isWithinDirectory("/tmp/dest", "")).toBe(true);
  });

  it("rejects entries that escape the destination", () => {
    expect(isWithinDirectory("/tmp/dest", "../evil.wav")).toBe(false);
    expect(isWithinDirectory("/tmp/dest", "../../etc/passwd")).toBe(false);
    expect(isWithinDirectory("/tmp/dest", "/etc/passwd")).toBe(false);
  });

  it("does not treat sibling prefixes as inside", () => {
    // "/tmp/dest-evil" shares the "/tmp/dest" string prefix but is a sibling.
    expect(isWithinDirectory("/tmp/dest", "../dest-evil/x.wav")).toBe(false);
  });
});

describe("extractZipEntries", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-archive-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  // Build a zip on disk from a map of entry path -> contents.
  function buildZip(entries: Record<string, Buffer | string>): string {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(entries)) {
      zip.addFile(
        name,
        typeof content === "string" ? Buffer.from(content) : content,
      );
    }
    const zipPath = path.join(
      tmpRoot,
      `in-${Math.random().toString(36).slice(2)}.zip`,
    );
    zip.writeZip(zipPath);
    return zipPath;
  }

  function collectExtracted(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string, prefix: string) => {
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (fs.statSync(full).isDirectory()) {
          walk(full, rel);
        } else {
          out.push(rel);
        }
      }
    };
    walk(dir, "");
    return out.sort();
  }

  it("extracts valid entries into the destination", async () => {
    const zipPath = buildZip({
      "a.wav": "hello",
      "nested/b.wav": "world",
    });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(dest);

    await extractZipEntries(zipPath, dest, 2, () => {});

    expect(collectExtracted(dest)).toEqual(["a.wav", "nested/b.wav"]);
    expect(fs.readFileSync(path.join(dest, "a.wav"), "utf-8")).toBe("hello");
  });

  // NOTE: the Zip-Slip *path* defence is verified exhaustively by the
  // isValidEntry / isWithinDirectory unit tests above. We cannot build a real
  // archive containing a "../" entry here because the zip writer sanitises
  // entry names on write, so there is no integration fixture for it.

  it("rejects archives exceeding the total size limit", async () => {
    const big = Buffer.alloc(2048, 0x61); // 2 KiB
    const zipPath = buildZip({ "big.wav": big });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(dest);

    const limits: ArchiveLimits = {
      ...DEFAULT_ARCHIVE_LIMITS,
      maxTotalBytes: 1024,
    };

    await expect(
      extractZipEntries(zipPath, dest, 1, () => {}, limits),
    ).rejects.toThrow(/total uncompressed size limit/);
  });

  it("rejects archives exceeding the per-file size limit", async () => {
    const big = Buffer.alloc(2048, 0x62);
    const zipPath = buildZip({ "big.wav": big });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(dest);

    const limits: ArchiveLimits = {
      ...DEFAULT_ARCHIVE_LIMITS,
      maxFileBytes: 1024,
    };

    await expect(
      extractZipEntries(zipPath, dest, 1, () => {}, limits),
    ).rejects.toThrow(/per-file size limit/);
  });

  it("rejects archives exceeding the entry count limit", async () => {
    const zipPath = buildZip({
      "a.wav": "1",
      "b.wav": "2",
      "c.wav": "3",
    });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(dest);

    const limits: ArchiveLimits = {
      ...DEFAULT_ARCHIVE_LIMITS,
      maxEntries: 2,
    };

    await expect(
      extractZipEntries(zipPath, dest, 3, () => {}, limits),
    ).rejects.toThrow(/maximum entry count/);
  });

  it("counts only valid entries", async () => {
    const zipPath = buildZip({
      "__MACOSX/junk.wav": "junk",
      "a.wav": "1",
      "b.wav": "2",
    });
    await expect(countZipEntries(zipPath)).resolves.toBe(2);
  });
});

import type { AddressInfo } from "node:net";

import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ArchiveChecksumError,
  type ArchiveLimits,
  countZipEntries,
  DEFAULT_ARCHIVE_LIMITS,
  downloadArchive,
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
    fs.mkdirSync(dest, { recursive: true });

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
    fs.mkdirSync(dest, { recursive: true });

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
    fs.mkdirSync(dest, { recursive: true });

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
    fs.mkdirSync(dest, { recursive: true });

    const limits: ArchiveLimits = {
      ...DEFAULT_ARCHIVE_LIMITS,
      maxEntries: 2,
    };

    await expect(
      extractZipEntries(zipPath, dest, 3, () => {}, limits),
    ).rejects.toThrow(/maximum entry count/);
  });

  it("fails when a file can't be written", async () => {
    const zipPath = buildZip({ "kit/a.wav": "1" });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(path.join(dest, "kit", "a.wav"), { recursive: true });

    // A folder where the file should go makes the write fail
    await expect(extractZipEntries(zipPath, dest, 1, () => {})).rejects.toThrow(
      /Extraction failed: couldn't write .*a\.wav/,
    );
  });

  it("fails when a folder can't be created", async () => {
    const zipPath = buildZip({ "kit/a.wav": "1" });
    const dest = path.join(tmpRoot, "out");
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "kit"), "a file, not a folder");

    await expect(extractZipEntries(zipPath, dest, 1, () => {})).rejects.toThrow(
      /Extraction failed: couldn't create folder .*kit/,
    );
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

describe("downloadArchive", () => {
  const body = Buffer.alloc(64 * 1024, 0x5a);
  const bodySha256 = createHash("sha256").update(body).digest("hex");
  let tmpRoot: string;
  let server: http.Server;
  let baseUrl: string;
  let target: string;

  beforeEach(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-download-test-"));
    target = path.join(tmpRoot, "archive.zip");
    server = http.createServer((req, res) => {
      switch (req.url) {
        case "/archive.zip":
          res.writeHead(200, { "Content-Length": body.length });
          res.end(body);
          return;
        case "/moved":
          res.writeHead(302, { Location: "/archive.zip" });
          res.end();
          return;
        case "/stall":
          // Headers and a first chunk, then nothing
          res.writeHead(200, { "Content-Length": body.length });
          res.write(body.subarray(0, 1024));
          return;
        default:
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end("<html>Not found</html>");
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  const leftovers = () => fs.readdirSync(tmpRoot);

  it("saves the body and reports progress up to 100%", async () => {
    const progress: (null | number)[] = [];
    await downloadArchive(`${baseUrl}/archive.zip`, target, (p) =>
      progress.push(p),
    );

    expect(fs.readFileSync(target)).toEqual(body);
    expect(progress.at(-1)).toBe(100);
    expect(leftovers()).toEqual(["archive.zip"]);
  });

  it("fails on a non-2xx response and keeps nothing", async () => {
    await expect(
      downloadArchive(`${baseUrl}/missing.zip`, target, () => {}),
    ).rejects.toThrow(/HTTP 404/);
    expect(leftovers()).toEqual([]);
  });

  it("follows a redirect to the archive", async () => {
    await downloadArchive(`${baseUrl}/moved`, target, () => {});
    expect(fs.readFileSync(target)).toEqual(body);
  });

  it("fails when no data arrives within the idle timeout", async () => {
    await expect(
      downloadArchive(`${baseUrl}/stall`, target, () => {}, {
        idleTimeoutMs: 200,
      }),
    ).rejects.toThrow(/stalled: no data received/);
    expect(leftovers()).toEqual([]);
  });

  it("accepts a matching checksum", async () => {
    await downloadArchive(`${baseUrl}/archive.zip`, target, () => {}, {
      expectedSha256: bodySha256,
    });
    expect(fs.existsSync(target)).toBe(true);
  });

  it("rejects a checksum mismatch and keeps nothing", async () => {
    const expected = "0".repeat(64);
    const error = await downloadArchive(
      `${baseUrl}/archive.zip`,
      target,
      () => {},
      { expectedSha256: expected },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ArchiveChecksumError);
    expect(error).toMatchObject({ actual: bodySha256, expected });
    expect(leftovers()).toEqual([]);
  });

  it("fails when the file can't be written", async () => {
    const unwritable = path.join(tmpRoot, "no-such-folder", "archive.zip");
    await expect(
      downloadArchive(`${baseUrl}/archive.zip`, unwritable, () => {}),
    ).rejects.toThrow(/ENOENT/);
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    const download = downloadArchive(`${baseUrl}/stall`, target, () => {}, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(new Error("Setup cancelled")), 50);

    await expect(download).rejects.toThrow("Setup cancelled");
    expect(leftovers()).toEqual([]);
  });
});

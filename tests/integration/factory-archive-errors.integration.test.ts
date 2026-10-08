import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  ArchiveService,
  SQUARP_FACTORY_SAMPLES_URL,
} from "../../electron/main/services/archiveService.js";
import { generatedFactoryArchive } from "../utils/generated-library";

// RE-77: a factory archive that arrives damaged used to be downloaded three
// times, and its real reason replaced by a generic network error. Main now
// says why it failed and whether another download could help.

// A small archive shaped like Squarp's, of generated audio
const ARCHIVE = generatedFactoryArchive();

describe("[UC-02] A damaged factory archive (RE-77)", () => {
  let tempDir: string;
  let target: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "factory-archive-"));
    target = path.join(tempDir, "store");
    fs.mkdirSync(target);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("refuses a download that doesn't match the checksum, and says not to expect a retry to help", async () => {
    // Squarp's URL answers with bytes that aren't the pinned archive
    const body = new Uint8Array(ARCHIVE);
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(body, {
          headers: { "Content-Length": String(body.length) },
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ArchiveService().downloadAndExtractArchive(
      SQUARP_FACTORY_SAMPLES_URL,
      target,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(SQUARP_FACTORY_SAMPLES_URL);
    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toMatch(
      /^The downloaded factory sample archive didn't match the expected checksum/,
    );
    // Nothing was extracted from the rejected download
    expect(fs.readdirSync(target)).toEqual([]);
  });

  it("refuses an archive that can't be unpacked, with the reason", async () => {
    const damaged = path.join(tempDir, "damaged.zip");
    fs.writeFileSync(
      damaged,
      ARCHIVE.subarray(0, Math.floor(ARCHIVE.length / 2)),
    );

    const result = await new ArchiveService().downloadAndExtractArchive(
      pathToFileURL(damaged).href,
      target,
    );

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toMatch(
      /^The factory sample archive couldn't be unpacked: /,
    );
  });

  it("marks a dropped connection as worth another download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const result = await new ArchiveService().downloadAndExtractArchive(
      SQUARP_FACTORY_SAMPLES_URL,
      target,
    );

    expect(result).toEqual({
      error:
        "Couldn't connect to the download server. Check your internet connection and try again.",
      retryable: true,
      success: false,
    });
  });
});

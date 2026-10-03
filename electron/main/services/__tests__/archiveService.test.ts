import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// EventEmitter-based stream mock
class MockStream extends EventEmitter {
  emitUnzipEvents?: () => void;
  headers?: Record<string, string>;
  close(cb?: Function) {
    if (cb) cb();
  }
  // Extraction tears streams down on failure; a real stream then closes
  destroy() {
    setImmediate(() => this.emit("close"));
  }
  pipe(dest: unknown) {
    if (dest && typeof dest.emitUnzipEvents === "function") {
      dest.emitUnzipEvents();
      return dest;
    }
    return dest;
  }
}

// Track unzipper streams for event emission
const unzipperStreams: unknown[] = [];
let lastWriteStream: MockStream | null = null;

vi.mock("node:fs", () => ({
  createReadStream: vi.fn(() => new MockStream()),
  createWriteStream: vi.fn(() => {
    const stream = new MockStream();
    lastWriteStream = stream;
    // A real fs.WriteStream emits "close" once writing completes. Extraction
    // now waits for every write to settle before resolving, so the mock must
    // model that signal or the handler would hang.
    setImmediate(() => stream.emit("close"));
    return stream;
  }),
  existsSync: vi.fn(() => true),
  mkdir: vi.fn((dir, opts, cb) => cb && cb(null)),
  mkdirSync: vi.fn(),
  promises: { unlink: vi.fn() },
}));
vi.mock("node:path", () => ({
  dirname: vi.fn((p) => p.split("/").slice(0, -1).join("/")),
  isAbsolute: vi.fn((p: string) => p.startsWith("/")),
  join: vi.fn((...args) => args.join("/")),
  resolve: vi.fn((...args: string[]) => {
    // Minimal resolve: join non-empty segments, keeping leading slash.
    const joined = args.filter(Boolean).join("/").replace(/\/+/g, "/");
    return joined.startsWith("/") ? joined : `/${joined}`;
  }),
  sep: "/",
}));

// Unzipper mock. vi.mock calls are hoisted, so per-test factories don't
// work (the last registered factory would silently win for the whole
// file) — instead the single top-level mock delegates entry emission to
// a swappable script that tests override and beforeEach resets.
const defaultUnzipScript = (stream: MockStream) => {
  setTimeout(() => {
    stream.emit("entry", {
      autodrain: () => {},
      on: () => {},
      path: "foo.wav",
      pipe: () => new MockStream(),
      type: "File",
    });
    stream.emit("entry", {
      autodrain: () => {},
      on: () => {},
      path: "bar/",
      pipe: () => new MockStream(),
      type: "Directory",
    });
    stream.emit("close");
  }, 10);
};
let unzipScript: (stream: MockStream) => void = defaultUnzipScript;

vi.mock("unzipper", () => ({
  Parse: vi.fn(() => {
    const stream = new MockStream();
    (stream as unknown as MockStream).emitUnzipEvents = () =>
      unzipScript(stream);
    unzipperStreams.push(stream);
    return stream;
  }),
}));
// The download itself is covered against a real HTTP server in
// archiveUtils.test.ts; here it's a stub that reports progress and resolves.
vi.mock("../../archiveUtils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../archiveUtils")>()),
  downloadArchive: vi.fn(),
}));
const fakeDownload = async (
  _url: string,
  _target: string,
  onProgress: (percent: null | number) => void,
) => {
  onProgress(50);
  onProgress(100);
};

const mockEvent = { sender: { send: vi.fn() } };

// The handler takes only the destination; the archive URL comes from main
// (ROMPER_SQUARP_ARCHIVE_URL overrides the Squarp default).
async function invokeWithArchiveUrl(handler: unknown, url: string) {
  process.env.ROMPER_SQUARP_ARCHIVE_URL = url;
  try {
    return await (handler as Function)(mockEvent, "/mock/dest");
  } finally {
    delete process.env.ROMPER_SQUARP_ARCHIVE_URL;
  }
}

vi.mock("../../security/pathAccess.js", () => ({
  checkPathAccess: vi.fn(() => ({ ok: true })),
  pathAccess: {
    assertAllowed: vi.fn(),
    grantRead: vi.fn(),
    grantRoot: vi.fn(),
    useSettings: vi.fn(),
  },
}));
const ipcMainHandlers: { [key: string]: unknown } = {};
vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/mock/userData") },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((name, fn) => {
      ipcMainHandlers[name] = fn;
    }),
  },
}));

beforeEach(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  Object.keys(ipcMainHandlers).forEach((k) => delete ipcMainHandlers[k]);
  vi.clearAllMocks();
  unzipperStreams.length = 0;
  lastWriteStream = null;
  unzipScript = defaultUnzipScript;
  vi.mocked(fs.mkdir).mockImplementation(((
    _dir: unknown,
    _opts: unknown,
    cb: (err: Error | null) => void,
  ) => cb(null)) as unknown as typeof fs.mkdir);
  vi.mocked(fs.createReadStream).mockImplementation(
    () => new MockStream() as unknown as fs.ReadStream,
  );
  vi.mocked(fs.existsSync).mockReturnValue(true);
  const { downloadArchive } = await import("../../archiveUtils");
  vi.mocked(downloadArchive).mockImplementation(fakeDownload);
  const { registerIpcHandlers } = await import("../../ipcHandlers");
  registerIpcHandlers({}, {});
});

describe("[UC-02] download-and-extract-archive handler", () => {
  it("emits progress events for download and extraction", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://example.com/archive.zip",
    );
    expect(result).toBeTypeOf("object");
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("handles extraction errors and emits archive-error", async () => {
    (fs.createReadStream as unknown).mockImplementationOnce(
      () => new MockStream(),
    );
    (fs.createReadStream as unknown).mockImplementationOnce(() => {
      throw new Error("fail");
    });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://example.com/archive.zip",
    );
    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("handles download errors and emits archive-error", async () => {
    const { downloadArchive } = await import("../../archiveUtils");
    vi.mocked(downloadArchive).mockRejectedValueOnce(
      new Error("Download failed: the server answered HTTP 404 Not Found"),
    );
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://fail.com/archive.zip",
    );
    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("skips __MACOSX and dot-underscore entries", async () => {
    unzipScript = (stream) => {
      setTimeout(() => {
        stream.emit("entry", {
          autodrain: vi.fn(),
          path: "__MACOSX/._foo.wav",
          pipe: vi.fn(),
          type: "File",
        });
        stream.emit("entry", {
          autodrain: vi.fn(),
          path: "._bar.wav",
          pipe: vi.fn(),
          type: "File",
        });
        stream.emit("close");
      }, 10);
    };
    (fs.createReadStream as unknown).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://skip.com/archive.zip",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("handles zero valid entries gracefully", async () => {
    unzipScript = (stream) => {
      setTimeout(() => {
        stream.emit("close");
      }, 10);
    };
    (fs.createReadStream as unknown).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://zero.com/archive.zip",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("fails extraction when a folder can't be created (RE-24)", async () => {
    (fs.mkdir as unknown).mockImplementation(
      (dir: unknown, opts: unknown, cb: unknown) =>
        cb && cb(new Error("mkdir fail")),
    );
    (fs.createReadStream as unknown).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://mkdir.com/archive.zip",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/couldn't create folder.*mkdir fail/);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("fails extraction when a file can't be written (RE-24)", async () => {
    unzipScript = (stream) => {
      setTimeout(() => {
        // Emit an entry to trigger file extraction
        stream.emit("entry", {
          autodrain: () => {},
          on: () => {},
          path: "foo.wav",
          pipe: () => new MockStream(),
          type: "File",
        });
        // Simulate a failure on the destination write stream (created
        // synchronously while handling the entry above).
        if (lastWriteStream) {
          lastWriteStream.emit("error", new Error("write fail"));
        }
        // End extraction
        setTimeout(() => stream.emit("close"), 20);
      }, 1);
    };
    (fs.createReadStream as unknown).mockImplementation(() => {
      const s = new MockStream();
      setTimeout(() => {
        // Trigger unzipper events
        unzipperStreams.forEach((z) => z.emitUnzipEvents?.());
      }, 1);
      return s;
    });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://write.com/archive.zip",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(
      /couldn't write \/mock\/dest\/foo\.wav: write fail/,
    );
  }, 15000);

  it("rejects non-https, non-file URL schemes", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "http://insecure.com/archive.zip",
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/only https:\/\/ and file:\/\/ are allowed/);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("handles file:// URLs for local archive files", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "file:///mock/local/archive.zip",
    );

    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("decodes a file:// URL to a real path (escapes, Windows drives)", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { pathToFileURL } = await import("node:url");
    const local =
      process.platform === "win32"
        ? String.raw`C:\My Samples\archive.zip`
        : "/My Samples/archive.zip";

    const handler = ipcMainHandlers["download-and-extract-archive"];
    await invokeWithArchiveUrl(handler, pathToFileURL(local).href);

    expect(fs.existsSync).toHaveBeenCalledWith(local);
  }, 15000);

  it("handles file:// URLs for non-existent local files", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "file:///mock/nonexistent/archive.zip",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Local file does not exist");
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("forwards download progress", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://large.com/archive.zip",
    );

    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-progress",
      expect.objectContaining({ percent: 50, phase: "Downloading" }),
    );
  }, 15000);
});

describe("[UC-02] temporary archive cleanup (RE-24)", () => {
  const tempZip = expect.stringMatching(/romper_download_\d+\.zip$/);

  it("deletes the downloaded zip after a successful setup", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://example.com/archive.zip",
    );

    expect(result.success).toBe(true);
    expect(fs.promises.unlink).toHaveBeenCalledWith(tempZip);
  }, 15000);

  it("deletes the downloaded zip when extraction fails", async () => {
    vi.mocked(fs.createReadStream)
      .mockImplementationOnce(
        () => new MockStream() as unknown as fs.ReadStream,
      )
      .mockImplementationOnce(() => {
        throw new Error("fail");
      });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "https://example.com/archive.zip",
    );

    expect(result.success).toBe(false);
    expect(fs.promises.unlink).toHaveBeenCalledWith(tempZip);
  }, 15000);

  it("never deletes a local file:// archive", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await invokeWithArchiveUrl(
      handler,
      "file:///mock/local/archive.zip",
    );

    expect(result.success).toBe(true);
    expect(fs.promises.unlink).not.toHaveBeenCalled();
  }, 15000);
});

describe("[UC-02] factory archive checksum (RE-24)", () => {
  async function downloadOptionsFor(url: string | undefined) {
    const { archiveService } = await import("../archiveService");
    const { downloadArchive } = await import("../../archiveUtils");
    if (url) process.env.ROMPER_SQUARP_ARCHIVE_URL = url;
    try {
      const { getFactorySamplesArchiveUrl } = await import("../archiveService");
      await archiveService.downloadAndExtractArchive(
        getFactorySamplesArchiveUrl(),
        "/mock/dest",
      );
    } finally {
      delete process.env.ROMPER_SQUARP_ARCHIVE_URL;
    }
    return vi.mocked(downloadArchive).mock.calls[0][3];
  }

  it("checks Squarp's archive against the pinned SHA-256", async () => {
    const { SQUARP_FACTORY_SAMPLES_SHA256 } = await import("../archiveService");
    expect(await downloadOptionsFor(undefined)).toEqual({
      expectedSha256: SQUARP_FACTORY_SAMPLES_SHA256,
    });
  });

  it("doesn't check an overridden archive URL", async () => {
    expect(
      await downloadOptionsFor("https://mirror.example/archive.zip"),
    ).toEqual({ expectedSha256: undefined });
  });

  it("explains a mismatch, and says another download won't help (RE-77)", async () => {
    const { ArchiveChecksumError, downloadArchive } =
      await import("../../archiveUtils");
    vi.mocked(downloadArchive).mockRejectedValueOnce(
      new ArchiveChecksumError("a".repeat(64), "b".repeat(64)),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { archiveService, SQUARP_FACTORY_SAMPLES_URL } =
      await import("../archiveService");

    const result = await archiveService.downloadAndExtractArchive(
      SQUARP_FACTORY_SAMPLES_URL,
      "/mock/dest",
    );

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.error).toMatch(/didn't match the expected checksum/);
    expect(result.error).toMatch(/archive on Squarp's server has changed/);
    expect(result.error).toMatch(/update Romper, or set up from an SD card/);
  });
});

describe("[UC-02] which failures are worth another download (RE-77)", () => {
  async function failDownloadWith(error: unknown, url?: string) {
    const { downloadArchive } = await import("../../archiveUtils");
    vi.mocked(downloadArchive).mockRejectedValueOnce(error);
    const { archiveService, SQUARP_FACTORY_SAMPLES_URL } =
      await import("../archiveService");
    return archiveService.downloadAndExtractArchive(
      url ?? SQUARP_FACTORY_SAMPLES_URL,
      "/mock/dest",
    );
  }

  it("retries a dropped connection, and says to check it", async () => {
    const result = await failDownloadWith(new TypeError("fetch failed"));

    expect(result).toEqual({
      error:
        "Couldn't connect to the download server. Check your internet connection and try again.",
      retryable: true,
      success: false,
    });
  });

  it("retries a stalled download, keeping its own advice", async () => {
    const result = await failDownloadWith(
      new Error(
        "Download stalled: no data received for 60 seconds. Check your connection and try again.",
      ),
    );

    expect(result.retryable).toBe(true);
    expect(result.error).toBe(
      "Download stalled: no data received for 60 seconds. Check your connection and try again.",
    );
  });

  it("retries a temporary server error", async () => {
    const { ArchiveHttpError } = await import("../../archiveUtils");
    const result = await failDownloadWith(
      new ArchiveHttpError(503, "Service Unavailable"),
    );

    expect(result.retryable).toBe(true);
    expect(result.error).toBe(
      "Download failed: the server answered HTTP 503 Service Unavailable Check your internet connection and try again.",
    );
  });

  it("doesn't retry a missing archive (HTTP 404)", async () => {
    const { ArchiveHttpError } = await import("../../archiveUtils");
    const result = await failDownloadWith(
      new ArchiveHttpError(404, "Not Found"),
    );

    expect(result).toEqual({
      error: "Download failed: the server answered HTTP 404 Not Found",
      retryable: false,
      success: false,
    });
  });

  it("doesn't retry a checksum mismatch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ArchiveChecksumError } = await import("../../archiveUtils");
    const result = await failDownloadWith(
      new ArchiveChecksumError("a".repeat(64), "b".repeat(64)),
    );

    expect(result.retryable).toBe(false);
  });

  it("doesn't retry a full disk", async () => {
    const full = Object.assign(new Error("ENOSPC: no space left on device"), {
      code: "ENOSPC",
    });
    const result = await failDownloadWith(full);

    expect(result).toEqual({
      error: "ENOSPC: no space left on device",
      retryable: false,
      success: false,
    });
  });

  it("doesn't retry a damaged archive, and says it couldn't be unpacked", async () => {
    unzipScript = (stream) => {
      stream.emit("error", new Error("invalid signature: 0xf18abe10"));
    };
    const { archiveService, SQUARP_FACTORY_SAMPLES_URL } =
      await import("../archiveService");

    const result = await archiveService.downloadAndExtractArchive(
      SQUARP_FACTORY_SAMPLES_URL,
      "/mock/dest",
    );

    expect(result).toEqual({
      error:
        "The factory sample archive couldn't be unpacked: invalid signature: 0xf18abe10",
      retryable: false,
      success: false,
    });
  });

  it("doesn't retry a local archive that isn't there", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { archiveService } = await import("../archiveService");

    const result = await archiveService.downloadAndExtractArchive(
      "file:///mock/missing.zip",
      "/mock/dest",
    );

    expect(result.retryable).toBe(false);
    expect(result.error).toContain("Local file does not exist");
  });
});

describe("getFactorySamplesArchiveUrl (RE-03)", () => {
  it("defaults to the Squarp factory sample pack", async () => {
    const { getFactorySamplesArchiveUrl, SQUARP_FACTORY_SAMPLES_URL } =
      await import("../archiveService");
    delete process.env.ROMPER_SQUARP_ARCHIVE_URL;
    expect(SQUARP_FACTORY_SAMPLES_URL).toBe(
      "https://data.squarp.net/RampleSamplesV1-2.zip",
    );
    expect(getFactorySamplesArchiveUrl()).toBe(SQUARP_FACTORY_SAMPLES_URL);
  });

  it("uses ROMPER_SQUARP_ARCHIVE_URL from the launch environment", async () => {
    const { getFactorySamplesArchiveUrl } = await import("../archiveService");
    process.env.ROMPER_SQUARP_ARCHIVE_URL = "file:///fixtures/squarp.zip";
    try {
      expect(getFactorySamplesArchiveUrl()).toBe("file:///fixtures/squarp.zip");
    } finally {
      delete process.env.ROMPER_SQUARP_ARCHIVE_URL;
    }
  });

  it("ignores a URL passed by the renderer", async () => {
    const { archiveService } = await import("../archiveService");
    const spy = vi
      .spyOn(archiveService, "downloadAndExtractArchive")
      .mockResolvedValue({ success: true });
    const handler = ipcMainHandlers["download-and-extract-archive"] as Function;
    await handler(mockEvent, "/mock/dest", "https://evil.test/payload.zip");
    expect(spy).toHaveBeenCalledWith(
      "https://data.squarp.net/RampleSamplesV1-2.zip",
      "/mock/dest",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    spy.mockRestore();
  });
});

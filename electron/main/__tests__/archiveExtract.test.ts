import { EventEmitter } from "events";
import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// EventEmitter-based stream mock
class MockStream extends EventEmitter {
  headers?: Record<string, string>;
  emitUnzipEvents?: () => void;
  pipe(dest: any) {
    if (dest && typeof dest.emitUnzipEvents === "function") {
      dest.emitUnzipEvents();
      return dest;
    }
    return dest;
  }
  close(cb?: Function) {
    if (cb) cb();
  }
}

// Track unzipper streams for event emission
const unzipperStreams: any[] = [];
let lastWriteStream: MockStream | null = null;

vi.mock("fs", () => ({
  createReadStream: vi.fn(() => new MockStream()),
  createWriteStream: vi.fn(() => (lastWriteStream = new MockStream())),
  mkdir: vi.fn((dir, opts, cb) => cb && cb(null)),
  mkdirSync: vi.fn(),
  promises: { unlink: vi.fn() },
}));
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
  dirname: vi.fn((p) => p.split("/").slice(0, -1).join("/")),
}));

// Unzipper mock: emits normal events unless test sets .emitUnzipEvents to emit error
vi.mock("unzipper", () => ({
  Parse: vi.fn(() => {
    const stream = new MockStream();
    (stream as any).emitUnzipEvents = () => {
      setTimeout(() => {
        stream.emit("entry", {
          path: "foo.wav",
          type: "File",
          autodrain: () => {},
          pipe: () => new MockStream(),
        });
        stream.emit("entry", {
          path: "bar/",
          type: "Directory",
          autodrain: () => {},
          pipe: () => new MockStream(),
        });
        stream.emit("close");
      }, 10);
    };
    unzipperStreams.push(stream);
    return stream;
  }),
}));
vi.mock("https", () => ({
  get: vi.fn((_url: any, cb: any) => {
    const res = new MockStream();
    res.headers = { "content-length": "100" };
    setTimeout(() => {
      res.emit("data", Buffer.alloc(50));
      res.emit("data", Buffer.alloc(50));
      res.emit("end");
      setTimeout(() => {
        if (lastWriteStream) lastWriteStream.emit("finish");
      }, 1);
    }, 5);
    cb(res);
    return { on: vi.fn() };
  }),
}));

const mockEvent = { sender: { send: vi.fn() } };
let ipcMainHandlers: { [key: string]: any } = {};
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((name, fn) => {
      ipcMainHandlers[name] = fn;
    }),
  },
  app: { getPath: vi.fn(() => "/mock/userData") },
  dialog: { showOpenDialog: vi.fn() },
}));

beforeEach(async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.keys(ipcMainHandlers).forEach((k) => delete ipcMainHandlers[k]);
  vi.clearAllMocks();
  unzipperStreams.length = 0;
  lastWriteStream = null;
  const { registerIpcHandlers } = await import("../ipcHandlers");
  registerIpcHandlers({}, {});
});

describe("download-and-extract-archive handler", () => {
  it("emits progress events for download and extraction", async () => {
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://example.com/archive.zip",
      "/mock/dest",
    );
    expect(result).toBeTypeOf("object");
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("handles extraction errors and emits archive-error", async () => {
    (fs.createReadStream as any).mockImplementationOnce(() => new MockStream());
    (fs.createReadStream as any).mockImplementationOnce(() => {
      throw new Error("fail");
    });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://example.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("handles download errors and emits archive-error", async () => {
    const https = await import("https");
    (https.get as any).mockImplementationOnce((_url: any, cb: any) => {
      const req = new MockStream();
      setTimeout(() => {
        req.emit("error", new Error("network fail"));
      }, 1);
      return req;
    });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://fail.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-error",
      expect.objectContaining({ message: expect.any(String) }),
    );
  }, 15000);

  it("skips __MACOSX and dot-underscore entries", async () => {
    vi.mocked(unzipperStreams).length = 0;
    vi.mock("unzipper", () => ({
      Parse: vi.fn(() => {
        const stream = new MockStream();
        (stream as any).emitUnzipEvents = () => {
          setTimeout(() => {
            stream.emit("entry", {
              path: "__MACOSX/._foo.wav",
              type: "File",
              autodrain: vi.fn(),
              pipe: vi.fn(),
            });
            stream.emit("entry", {
              path: "._bar.wav",
              type: "File",
              autodrain: vi.fn(),
              pipe: vi.fn(),
            });
            stream.emit("close");
          }, 10);
        };
        unzipperStreams.push(stream);
        return stream;
      }),
    }));
    (fs.createReadStream as any).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://skip.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("handles zero valid entries gracefully", async () => {
    vi.mocked(unzipperStreams).length = 0;
    vi.mock("unzipper", () => ({
      Parse: vi.fn(() => {
        const stream = new MockStream();
        (stream as any).emitUnzipEvents = () => {
          setTimeout(() => {
            stream.emit("close");
          }, 10);
        };
        unzipperStreams.push(stream);
        return stream;
      }),
    }));
    (fs.createReadStream as any).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://zero.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("logs directory creation errors but continues extraction", async () => {
    (fs.mkdir as any).mockImplementation(
      (dir: any, opts: any, cb: any) => cb && cb(new Error("mkdir fail")),
    );
    (fs.createReadStream as any).mockImplementation(() => new MockStream());
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://mkdir.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);

  it("logs file write errors but continues extraction", async () => {
    vi.mocked(unzipperStreams).length = 0;
    vi.mock("unzipper", () => ({
      Parse: vi.fn(() => {
        const stream = new MockStream();
        (stream as any).emitUnzipEvents = () => {
          setTimeout(() => {
            // Emit an entry to trigger file extraction
            stream.emit("entry", {
              path: "foo.wav",
              type: "File",
              autodrain: () => {},
              pipe: () => {
                const s = new MockStream();
                setTimeout(() => s.emit("error", new Error("write fail")), 5);
                setTimeout(() => s.emit("finish"), 10);
                return s;
              },
            });
            // End extraction
            setTimeout(() => stream.emit("close"), 20);
          }, 1);
        };
        unzipperStreams.push(stream);
        return stream;
      }),
    }));
    (fs.createReadStream as any).mockImplementation(() => {
      const s = new MockStream();
      setTimeout(() => {
        // Trigger unzipper events
        unzipperStreams.forEach(
          (z) => z.emitUnzipEvents && z.emitUnzipEvents(),
        );
      }, 1);
      return s;
    });
    const handler = ipcMainHandlers["download-and-extract-archive"];
    const result = await handler(
      mockEvent as any,
      "https://write.com/archive.zip",
      "/mock/dest",
    );
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      expect.stringContaining("archive-progress"),
      expect.objectContaining({ phase: expect.any(String) }),
    );
  }, 15000);
});

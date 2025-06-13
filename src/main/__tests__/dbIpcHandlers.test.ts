import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerDbIpcHandlers } from "../dbIpcHandlers";

// Use a module-scoped variable to capture the handler
let handler: any;

// Mock electron with ipcMain.handle
vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, fn: any) => {
      if (channel === "create-romper-db") handler = fn;
    },
  },
}));

// Mock better-sqlite3 and path
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => ({
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));
vi.mock("path", async () => {
  const actual = await vi.importActual<any>("path");
  return {
    ...actual,
    join: (...args: string[]) => args.join("/"),
  };
});

describe("registerDbIpcHandlers", () => {
  beforeEach(() => {
    handler = undefined;
    registerDbIpcHandlers();
  });
  afterEach(() => {
    handler = undefined;
  });

  it("should return success and dbPath on valid call", async () => {
    const result = await handler({}, "/mock/path/.romperdb");
    expect(result.success).toBe(true);
    expect(result.dbPath).toBe("/mock/path/.romperdb/romper.sqlite");
  });

  it("should return error on DB failure", async () => {
    // Patch DB to throw
    const DB = (await import("better-sqlite3")).default;
    (DB as any).mockImplementationOnce(() => { throw new Error("fail!"); });
    const result = await handler({}, "/fail/path");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
  });
});

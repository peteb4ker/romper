import { vi } from "vitest";

/**
 * Centralized file system mock factory
 * Reduces duplication across 12+ test files that mock fs
 */
export const createFsMock = (overrides: Record<string, any> = {}) => ({
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date(),
  }),
  openSync: vi.fn().mockReturnValue(3), // file descriptor
  readSync: vi.fn().mockReturnValue(1024), // bytes read
  closeSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("mock file content")),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue(["file1.wav", "file2.wav"]),
  rmSync: vi.fn(),
  copyFileSync: vi.fn(),
  promises: {
    readFile: vi.fn().mockResolvedValue(Buffer.from("mock file content")),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(["file1.wav", "file2.wav"]),
    stat: vi.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
    }),
    rm: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
  },
  ...overrides,
});

/**
 * Centralized path mock factory
 */
export const createPathMock = (overrides: Record<string, any> = {}) => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  basename: vi.fn((p: string) => p.split("/").pop()),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  extname: vi.fn((p: string) => {
    const parts = p.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
  }),
  resolve: vi.fn((...args: string[]) => "/" + args.join("/")),
  sep: "/",
  delimiter: ":",
  ...overrides,
});

/**
 * Sets up fs module mock using vi.mock()
 */
export const mockFsModule = () => {
  vi.mock("fs", () => createFsMock());
};

/**
 * Sets up path module mock using vi.mock()
 */
export const mockPathModule = () => {
  vi.mock("path", () => createPathMock());
};

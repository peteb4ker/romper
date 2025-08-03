import { vi } from "vitest";

/**
 * Centralized file system mock factory
 * Reduces duplication across 12+ test files that mock fs
 */
export const createFsMock = (overrides: Record<string, any> = {}) => ({
  closeSync: vi.fn(),
  copyFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  openSync: vi.fn().mockReturnValue(3), // file descriptor
  promises: {
    copyFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(["file1.wav", "file2.wav"]),
    readFile: vi.fn().mockResolvedValue(Buffer.from("mock file content")),
    rm: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      mtime: new Date(),
      size: 1024,
    }),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  readdirSync: vi.fn().mockReturnValue(["file1.wav", "file2.wav"]),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("mock file content")),
  readSync: vi.fn().mockReturnValue(1024), // bytes read
  rmSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({
    isDirectory: () => false,
    isFile: () => true,
    mtime: new Date(),
    size: 1024,
  }),
  writeFileSync: vi.fn(),
  ...overrides,
});

/**
 * Centralized path mock factory
 */
export const createPathMock = (overrides: Record<string, any> = {}) => ({
  basename: vi.fn((p: string) => p.split("/").pop()),
  delimiter: ":",
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  extname: vi.fn((p: string) => {
    const parts = p.split(".");
    return parts.length > 1 ? `.${parts.pop()}` : "";
  }),
  join: vi.fn((...args: string[]) => args.join("/")),
  resolve: vi.fn((...args: string[]) => "/" + args.join("/")),
  sep: "/",
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

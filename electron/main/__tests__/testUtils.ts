import { vi } from "vitest";

/**
 * Common mock configurations for Electron main process tests
 * Reduces duplication across test files
 */

/**
 * Standard file system mocks used across multiple test files
 */
export const createFsMocks = () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
});

/**
 * Standard path mocks used across multiple test files
 */
export const createPathMocks = () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  basename: vi.fn((p: string) => p.split("/").pop()),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  extname: vi.fn((p: string) => {
    const parts = p.split(".");
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
  }),
});

/**
 * Common database operation mocks
 */
export const createDbMocks = () => ({
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  deleteSamplesWithoutCompaction: vi.fn(),
  getKitSamples: vi.fn(),
  getKits: vi.fn(),
  markKitAsModified: vi.fn(),
  moveSample: vi.fn(),
  addKit: vi.fn(),
  updateKit: vi.fn(),
  getKit: vi.fn(),
});

/**
 * Common audio utility mocks
 */
export const createAudioUtilMocks = () => ({
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(),
  convertAudioFormat: vi.fn(),
});

/**
 * Setup standard mocks for a test file
 */
export function setupStandardMocks() {
  vi.mock("fs", () => createFsMocks());
  vi.mock("path", () => createPathMocks());
}

/**
 * Setup database mocks for tests
 */
export function setupDbMocks() {
  vi.mock("../db/romperDbCoreORM.js", () => createDbMocks());
}

/**
 * Setup audio utility mocks for tests
 */
export function setupAudioMocks() {
  vi.mock("../audioUtils.js", () => createAudioUtilMocks());
}

import { vi } from "vitest";

/**
 * Common mock configurations for Electron main process tests
 * Reduces duplication across test files
 */

/**
 * Standard file system mocks used across multiple test files
 */
export const createFsMocks = () => ({
  closeSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn(),
  readFileSync: vi.fn(),
  readSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
});

/**
 * Standard path mocks used across multiple test files
 */
export const createPathMocks = () => ({
  basename: vi.fn((p: string) => p.split("/").pop()),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  extname: vi.fn((p: string) => {
    const parts = p.split(".");
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
  }),
  join: vi.fn((...args: string[]) => args.join("/")),
});

/**
 * Common database operation mocks
 */
export const createDbMocks = () => ({
  addKit: vi.fn(),
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
  deleteSamplesWithoutCompaction: vi.fn(),
  getKit: vi.fn(),
  getKits: vi.fn(),
  getKitSamples: vi.fn(),
  markKitAsModified: vi.fn(),
  moveSample: vi.fn(),
  updateKit: vi.fn(),
});

/**
 * Common audio utility mocks
 */
export const createAudioUtilMocks = () => ({
  convertAudioFormat: vi.fn(),
  getAudioMetadata: vi.fn(),
  validateSampleFormat: vi.fn(),
});

/**
 * Setup audio utility mocks for tests
 */
export function setupAudioMocks() {
  vi.mock("../audioUtils.js", () => createAudioUtilMocks());
}

/**
 * Setup database mocks for tests
 */
export function setupDbMocks() {
  vi.mock("../db/romperDbCoreORM.js", () => createDbMocks());
}

/**
 * Setup standard mocks for a test file
 */
export function setupStandardMocks() {
  vi.mock("fs", () => createFsMocks());
  vi.mock("path", () => createPathMocks());
}

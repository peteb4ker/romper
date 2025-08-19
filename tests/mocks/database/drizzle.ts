import type { DbResult } from "@romper/shared/db/schema";

import { vi } from "vitest";

/**
 * Centralized database mock factory for Drizzle ORM operations
 * Reduces duplication across tests that mock database operations
 */
export const createDatabaseMock = (overrides: Record<string, any> = {}) => ({
  // Database connection
  close: vi.fn().mockResolvedValue(undefined),

  deleteKit: vi.fn().mockResolvedValue({
    data: undefined,
    success: true,
  }),

  deleteSample: vi.fn().mockResolvedValue({
    data: undefined,
    success: true,
  }),

  // Bank operations
  getAllBanks: vi.fn().mockResolvedValue({
    data: [
      {
        artist: "Test Artist A",
        letter: "A",
        rtf_filename: null,
        scanned_at: new Date().toISOString(),
      },
    ],
    success: true,
  }),

  // Kit operations
  getAllKits: vi.fn().mockResolvedValue({
    data: [
      {
        alias: null,
        artist: null,
        bank_letter: "A",
        created_at: new Date().toISOString(),
        editable: false,
        id: 1,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        scanned_at: new Date().toISOString(),
        step_pattern: null,
        updated_at: new Date().toISOString(),
      },
    ],
    success: true,
  } as DbResult<any[]>),

  // Sample operations
  getAllSamplesForKit: vi.fn().mockResolvedValue({
    data: [
      {
        bit_depth: 16,
        channels: 1,
        created_at: new Date().toISOString(),
        duration_seconds: 1.0,
        file_path: "/mock/local/store/A0/1 Kick.wav",
        file_size: 44100,
        filename: "1 Kick.wav",
        format: "wav",
        id: 1,
        kit_name: "A0",
        sample_rate: 44100,
        slot_number: 0,
        updated_at: new Date().toISOString(),
        voice_number: 1,
      },
    ],
    success: true,
  }),

  getKit: vi.fn().mockResolvedValue({
    data: {
      alias: null,
      artist: null,
      bank_letter: "A",
      created_at: new Date().toISOString(),
      editable: false,
      id: 1,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      scanned_at: new Date().toISOString(),
      step_pattern: null,
      updated_at: new Date().toISOString(),
    },
    success: true,
  }),

  insertBank: vi.fn().mockResolvedValue({
    data: { artist: "Test Artist A", letter: "A" },
    success: true,
  }),

  insertKit: vi.fn().mockResolvedValue({
    data: { id: 1, name: "A0" },
    success: true,
  }),

  insertSample: vi.fn().mockResolvedValue({
    data: { filename: "1 Kick.wav", id: 1 },
    success: true,
  }),

  // Transaction helpers
  transaction: vi.fn().mockImplementation((callback) => {
    return Promise.resolve(callback({}));
  }),

  updateBank: vi.fn().mockResolvedValue({
    data: { artist: "Test Artist A", letter: "A" },
    success: true,
  }),

  updateKit: vi.fn().mockResolvedValue({
    data: { id: 1, name: "A0" },
    success: true,
  }),

  updateSample: vi.fn().mockResolvedValue({
    data: { filename: "1 Kick.wav", id: 1 },
    success: true,
  }),

  ...overrides,
});

/**
 * Mock for database error scenarios
 */
export const createDatabaseErrorMock = (
  errorMessage: string = "Database error"
) => ({
  ...createDatabaseMock(),
  getAllKits: vi.fn().mockResolvedValue({
    error: errorMessage,
    success: false,
  }),
  getKit: vi.fn().mockResolvedValue({
    error: errorMessage,
    success: false,
  }),
  insertKit: vi.fn().mockResolvedValue({
    error: errorMessage,
    success: false,
  }),
});

/**
 * Sets up database module mock using vi.mock()
 */
export const mockDatabaseModule = () => {
  vi.mock("../../../electron/main/db/database", () => ({
    db: createDatabaseMock(),
  }));
};

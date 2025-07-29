import { vi } from "vitest";

import type { DbResult } from "../../../shared/db/schema";

/**
 * Centralized database mock factory for Drizzle ORM operations
 * Reduces duplication across tests that mock database operations
 */
export const createDatabaseMock = (overrides: Record<string, any> = {}) => ({
  // Kit operations
  getAllKits: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 1,
        name: "A0",
        bank_letter: "A",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        scanned_at: new Date().toISOString(),
      },
    ],
  } as DbResult<any[]>),

  getKit: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 1,
      name: "A0",
      bank_letter: "A",
      alias: null,
      artist: null,
      editable: false,
      locked: false,
      step_pattern: null,
      modified_since_sync: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scanned_at: new Date().toISOString(),
    },
  }),

  insertKit: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 1, name: "A0" },
  }),

  updateKit: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 1, name: "A0" },
  }),

  deleteKit: vi.fn().mockResolvedValue({
    success: true,
    data: undefined,
  }),

  // Sample operations
  getAllSamplesForKit: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 1,
        kit_name: "A0",
        filename: "1 Kick.wav",
        voice_number: 1,
        slot_number: 0,
        file_path: "/mock/local/store/A0/1 Kick.wav",
        file_size: 44100,
        duration_seconds: 1.0,
        sample_rate: 44100,
        bit_depth: 16,
        channels: 1,
        format: "wav",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  }),

  insertSample: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 1, filename: "1 Kick.wav" },
  }),

  updateSample: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 1, filename: "1 Kick.wav" },
  }),

  deleteSample: vi.fn().mockResolvedValue({
    success: true,
    data: undefined,
  }),

  // Bank operations
  getAllBanks: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        letter: "A",
        artist: "Test Artist A",
        rtf_filename: null,
        scanned_at: new Date().toISOString(),
      },
    ],
  }),

  insertBank: vi.fn().mockResolvedValue({
    success: true,
    data: { letter: "A", artist: "Test Artist A" },
  }),

  updateBank: vi.fn().mockResolvedValue({
    success: true,
    data: { letter: "A", artist: "Test Artist A" },
  }),

  // Transaction helpers
  transaction: vi.fn().mockImplementation((callback) => {
    return Promise.resolve(callback({}));
  }),

  // Database connection
  close: vi.fn().mockResolvedValue(undefined),

  ...overrides,
});

/**
 * Mock for database error scenarios
 */
export const createDatabaseErrorMock = (
  errorMessage: string = "Database error",
) => ({
  ...createDatabaseMock(),
  getAllKits: vi.fn().mockResolvedValue({
    success: false,
    error: errorMessage,
  }),
  getKit: vi.fn().mockResolvedValue({
    success: false,
    error: errorMessage,
  }),
  insertKit: vi.fn().mockResolvedValue({
    success: false,
    error: errorMessage,
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

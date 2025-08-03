import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Standard setup and teardown for React component tests
 * Ensures consistent mock management across test files
 */
export const standardReactSetup = () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
};

/**
 * Standard setup for service/utility tests (non-React)
 */
export const standardServiceSetup = () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};

/**
 * Setup for database integration tests
 */
export const databaseIntegrationSetup = () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};

/**
 * Mock timer utilities for tests involving timeouts/intervals
 */
export const withMockTimers = (callback: () => Promise<void> | void) => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return callback;
};

/**
 * Utility for waiting for async operations in tests
 */
export const waitFor = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock console methods to avoid test output noise
 */
export const suppressConsole = () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};

/**
 * Mock window location for tests that need URL manipulation
 */
export const mockWindowLocation = (url: string = "http://localhost:3000") => {
  const mockLocation = new URL(url);

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: mockLocation,
      writable: true,
    });
  });
};

/**
 * Create a mock file for file input tests
 */
export const createMockFile = (
  filename: string = "test.wav",
  type: string = "audio/wav",
  size: number = 1024,
): File => {
  const file = new File(["mock file content"], filename, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

/**
 * Create mock FileList for multiple file inputs
 */
export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    item: (index: number) => files[index] || null,
    length: files.length,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Add files as indexed properties
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as FileList;
};

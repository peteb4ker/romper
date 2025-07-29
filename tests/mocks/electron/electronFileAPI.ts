import { vi } from "vitest";

/**
 * Centralized electronFileAPI mock
 * Used for file drop/drag operations in renderer tests
 */
export const createElectronFileAPIMock = () => ({
  getDroppedFilePath: vi.fn().mockImplementation(async (file) => {
    if (file && typeof file === "object" && "path" in file) {
      return file.path;
    }
    if (file && typeof file === "object" && "name" in file) {
      return file.name;
    }
    return "";
  }),
});

/**
 * Default electronFileAPI mock for global setup
 */
export const defaultElectronFileAPIMock = createElectronFileAPIMock();

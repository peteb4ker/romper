// Tests for kit operations utilities

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createKit,
  duplicateKit,
  formatKitOperationError,
  validateKitSlot,
} from "../kitOperations";

// Mock the global window.electronAPI
const mockElectronAPI = {
  createKit: vi.fn(),
  copyKit: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.window = {
    ...global.window,
    electronAPI: mockElectronAPI,
  } as any;
});

describe("validateKitSlot", () => {
  it("validates correct kit slot formats", () => {
    expect(validateKitSlot("A0")).toBe(true);
    expect(validateKitSlot("A1")).toBe(true);
    expect(validateKitSlot("A99")).toBe(true);
    expect(validateKitSlot("Z0")).toBe(true);
    expect(validateKitSlot("Z99")).toBe(true);
    expect(validateKitSlot("M12")).toBe(true);
  });

  it("rejects invalid kit slot formats", () => {
    expect(validateKitSlot("")).toBe(false);
    expect(validateKitSlot("A")).toBe(false);
    expect(validateKitSlot("1A")).toBe(false);
    expect(validateKitSlot("AA1")).toBe(false);
    expect(validateKitSlot("a1")).toBe(false);
    expect(validateKitSlot("A100")).toBe(false);
    expect(validateKitSlot("A-1")).toBe(false);
    expect(validateKitSlot("A1a")).toBe(false);
  });
});

describe("createKit", () => {
  it("successfully creates a kit with valid slot", async () => {
    mockElectronAPI.createKit.mockResolvedValue(undefined);

    await createKit("/test/path", "A1");

    expect(mockElectronAPI.createKit).toHaveBeenCalledWith("/test/path", "A1");
  });

  it("throws error for invalid kit slot", async () => {
    await expect(createKit("/test/path", "invalid")).rejects.toThrow(
      "Invalid kit slot. Use format A0-Z99.",
    );

    expect(mockElectronAPI.createKit).not.toHaveBeenCalled();
  });

  it("throws error when Electron API is not available", async () => {
    global.window = { electronAPI: {} } as any;

    await expect(createKit("/test/path", "A1")).rejects.toThrow(
      "Electron API not available",
    );
  });

  it("propagates Electron API errors", async () => {
    mockElectronAPI.createKit.mockRejectedValue(new Error("Disk full"));

    await expect(createKit("/test/path", "A1")).rejects.toThrow("Disk full");
  });
});

describe("duplicateKit", () => {
  it("successfully duplicates a kit with valid slots", async () => {
    mockElectronAPI.copyKit.mockResolvedValue(undefined);

    await duplicateKit("/test/path", "A1", "B2");

    expect(mockElectronAPI.copyKit).toHaveBeenCalledWith(
      "/test/path",
      "A1",
      "B2",
    );
  });

  it("throws error for invalid destination slot", async () => {
    await expect(duplicateKit("/test/path", "A1", "invalid")).rejects.toThrow(
      "Invalid destination slot. Use format A0-Z99.",
    );

    expect(mockElectronAPI.copyKit).not.toHaveBeenCalled();
  });

  it("throws error when Electron API is not available", async () => {
    global.window = { electronAPI: {} } as any;

    await expect(duplicateKit("/test/path", "A1", "B2")).rejects.toThrow(
      "Electron API not available",
    );
  });

  it("cleans up error messages from Electron API", async () => {
    mockElectronAPI.copyKit.mockRejectedValue(
      new Error(
        "Error invoking remote method 'copy-kit': Error: Source kit not found",
      ),
    );

    await expect(duplicateKit("/test/path", "A1", "B2")).rejects.toThrow(
      "Source kit not found",
    );
  });

  it("handles various error message formats", async () => {
    // Test different error prefixes
    mockElectronAPI.copyKit.mockRejectedValue(
      new Error("Error: Kit already exists"),
    );

    await expect(duplicateKit("/test/path", "A1", "B2")).rejects.toThrow(
      "Kit already exists",
    );
  });
});

describe("formatKitOperationError", () => {
  it("formats error messages for kit operations", () => {
    const error = new Error("Something went wrong");
    const result = formatKitOperationError(error, "create");

    expect(result).toBe("Failed to create kit: Something went wrong");
  });

  it("handles non-Error objects", () => {
    const result = formatKitOperationError("String error", "duplicate");

    expect(result).toBe("Failed to duplicate kit: String error");
  });

  it("handles different operations", () => {
    const error = new Error("Test error");

    expect(formatKitOperationError(error, "create")).toContain("create");
    expect(formatKitOperationError(error, "duplicate")).toContain("duplicate");
    expect(formatKitOperationError(error, "delete")).toContain("delete");
  });
});

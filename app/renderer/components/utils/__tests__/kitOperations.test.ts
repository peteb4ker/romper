// Tests for kit operations utilities

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createKit,
  duplicateKit,
  formatKitError,
  formatKitOperationError,
  validateKitSlot,
} from "../kitOperations";

// Mock the global window.electronAPI
const mockElectronAPI = {
  copyKit: vi.fn(),
  createKit: vi.fn(),
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

    await createKit("A1");

    expect(mockElectronAPI.createKit).toHaveBeenCalledWith("A1");
  });

  it("throws error for invalid kit slot", async () => {
    await expect(createKit("invalid")).rejects.toThrow(
      "Invalid kit slot. Use format A0-Z99.",
    );

    expect(mockElectronAPI.createKit).not.toHaveBeenCalled();
  });

  it("throws error when Electron API is not available", async () => {
    global.window = { electronAPI: {} } as any;

    await expect(createKit("A1")).rejects.toThrow("Electron API not available");
  });

  it("propagates Electron API errors", async () => {
    mockElectronAPI.createKit.mockRejectedValue(new Error("Disk full"));

    await expect(createKit("A1")).rejects.toThrow("Disk full");
  });
});

describe("duplicateKit", () => {
  it("successfully duplicates a kit with valid slots", async () => {
    mockElectronAPI.copyKit.mockResolvedValue(undefined);

    await duplicateKit("A1", "B2");

    expect(mockElectronAPI.copyKit).toHaveBeenCalledWith("A1", "B2");
  });

  it("throws error for invalid destination slot", async () => {
    await expect(duplicateKit("A1", "invalid")).rejects.toThrow(
      "Invalid destination slot. Use format A0-Z99.",
    );

    expect(mockElectronAPI.copyKit).not.toHaveBeenCalled();
  });

  it("throws error when Electron API is not available", async () => {
    global.window = { electronAPI: {} } as any;

    await expect(duplicateKit("A1", "B2")).rejects.toThrow(
      "Electron API not available",
    );
  });

  it("cleans up error messages from Electron API", async () => {
    mockElectronAPI.copyKit.mockRejectedValue(
      new Error(
        "Error invoking remote method 'copy-kit': Error: Source kit not found",
      ),
    );

    await expect(duplicateKit("A1", "B2")).rejects.toThrow(
      "Source kit not found",
    );
  });

  it("handles various error message formats", async () => {
    // Test different error prefixes
    mockElectronAPI.copyKit.mockRejectedValue(
      new Error("Error: Kit already exists"),
    );

    await expect(duplicateKit("A1", "B2")).rejects.toThrow(
      "Kit already exists",
    );
  });
});

describe("formatKitError", () => {
  it("simplifies duplicate kit error message", () => {
    const error = new Error("Kit already exists.");
    const result = formatKitError(error);

    expect(result).toBe("Kit already exists");
  });

  it("preserves generic error messages with prefix", () => {
    const error = new Error("Invalid kit slot format");
    const result = formatKitError(error);

    expect(result).toBe("Failed to create kit: Invalid kit slot format");
  });

  it("handles non-Error objects", () => {
    const result = formatKitError("String error");

    expect(result).toBe("Failed to create kit: String error");
  });

  it("handles Error objects with different messages", () => {
    const error1 = new Error("File not found");
    const error2 = new Error("Permission denied");

    expect(formatKitError(error1)).toBe("Failed to create kit: File not found");
    expect(formatKitError(error2)).toBe(
      "Failed to create kit: Permission denied",
    );
  });

  it("handles undefined and null", () => {
    expect(formatKitError(undefined)).toBe("Failed to create kit: undefined");
    expect(formatKitError(null)).toBe("Failed to create kit: null");
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

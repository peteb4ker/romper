import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock path
vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  addKit: vi.fn(),
  copyKit: vi.fn(),
  deleteKit: vi.fn(),
  getKit: vi.fn(),
  getKitDeleteSummary: vi.fn(),
}));

import {
  addKit,
  copyKit,
  deleteKit,
  getKit,
  getKitDeleteSummary,
} from "../../db/romperDbCoreORM.js";
import { KitService } from "../kitService.js";

const mockPath = vi.mocked(path);
const mockAddKit = vi.mocked(addKit);
const mockCopyKit = vi.mocked(copyKit);
const mockDeleteKit = vi.mocked(deleteKit);
const mockGetKit = vi.mocked(getKit);
const mockGetKitDeleteSummary = vi.mocked(getKitDeleteSummary);

describe("KitService", () => {
  let kitService: KitService;
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    kitService = new KitService();

    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockAddKit.mockReturnValue({ success: true });
    mockCopyKit.mockReturnValue({ success: true });
    mockGetKit.mockReturnValue({ success: false }); // Kit doesn't exist by default
  });

  describe("createKit", () => {
    it("successfully creates a new kit", () => {
      const result = kitService.createKit(mockInMemorySettings, "A5");

      expect(result.success).toBe(true);
      expect(mockGetKit).toHaveBeenCalledWith("/test/path/.romperdb", "A5");
      expect(mockAddKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          alias: null,
          bank_letter: "A",
          editable: true,
          locked: false,
          modified_since_sync: false,
          name: "A5",
          step_pattern: null,
        }),
      );
    });

    it("rejects invalid kit slot format", () => {
      expect(() => {
        kitService.createKit(mockInMemorySettings, "invalid");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("rejects if kit already exists", () => {
      mockGetKit.mockReturnValue({
        data: { bank_letter: "A", name: "A5" },
        success: true,
      });

      const result = kitService.createKit(mockInMemorySettings, "A5");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kit already exists.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = kitService.createKit({}, "A5");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("validates various kit slot formats", () => {
      const validSlots = ["A0", "B12", "Z99", "M5"];
      const invalidSlots = ["AA0", "A", "A100", "a5", "0A", ""];

      validSlots.forEach((slot) => {
        mockGetKit.mockReturnValue({ success: false }); // Reset to "doesn't exist"
        const result = kitService.createKit(mockInMemorySettings, slot);
        expect(result.success).toBe(true, `${slot} should be valid`);
      });

      invalidSlots.forEach((slot) => {
        expect(() => {
          kitService.createKit(mockInMemorySettings, slot);
        }).toThrow("Invalid kit slot. Use format A0-Z99.");
      });
    });

    it("extracts bank letter correctly", () => {
      kitService.createKit(mockInMemorySettings, "K7");

      expect(mockAddKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          bank_letter: "K",
          name: "K7",
        }),
      );
    });
  });

  describe("copyKit", () => {
    it("delegates to the atomic db copy operation", () => {
      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(true);
      expect(mockCopyKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "A1",
        "B2",
      );
    });

    it("rejects invalid source kit slot", () => {
      expect(() => {
        kitService.copyKit(mockInMemorySettings, "invalid", "B2");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
      expect(mockCopyKit).not.toHaveBeenCalled();
    });

    it("rejects invalid destination kit slot", () => {
      expect(() => {
        kitService.copyKit(mockInMemorySettings, "A1", "invalid");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
      expect(mockCopyKit).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = kitService.copyKit({}, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
      expect(mockCopyKit).not.toHaveBeenCalled();
    });

    it("passes through missing-source errors from the db layer", () => {
      mockCopyKit.mockReturnValue({
        error: "Source kit does not exist.",
        success: false,
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Source kit does not exist.");
    });

    it("passes through existing-destination errors from the db layer", () => {
      mockCopyKit.mockReturnValue({
        error: "Destination kit already exists.",
        success: false,
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Destination kit already exists.");
    });
  });

  describe("deleteKit", () => {
    it("successfully deletes an unlocked kit", () => {
      mockGetKit.mockReturnValue({
        data: { locked: false, name: "A0" },
        success: true,
      });
      mockDeleteKit.mockReturnValue({ success: true });

      const result = kitService.deleteKit(mockInMemorySettings, "A0");

      expect(result.success).toBe(true);
      expect(mockDeleteKit).toHaveBeenCalledWith("/test/path/.romperdb", "A0");
    });

    it("rejects deletion of locked kit", () => {
      mockGetKit.mockReturnValue({
        data: { locked: true, name: "A0" },
        success: true,
      });

      const result = kitService.deleteKit(mockInMemorySettings, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kit is locked. Unlock it before deleting.");
      expect(mockDeleteKit).not.toHaveBeenCalled();
    });

    it("returns error for non-existent kit", () => {
      mockGetKit.mockReturnValue({ success: false });

      const result = kitService.deleteKit(mockInMemorySettings, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Kit not found.");
      expect(mockDeleteKit).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = kitService.deleteKit({}, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("rejects invalid kit slot format", () => {
      expect(() => {
        kitService.deleteKit(mockInMemorySettings, "invalid");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
    });
  });

  describe("getKitDeleteSummary", () => {
    it("returns summary from database layer", () => {
      mockGetKitDeleteSummary.mockReturnValue({
        data: { kitName: "A0", locked: false, sampleCount: 5, voiceCount: 4 },
        success: true,
      });

      const result = kitService.getKitDeleteSummary(mockInMemorySettings, "A0");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        kitName: "A0",
        locked: false,
        sampleCount: 5,
        voiceCount: 4,
      });
    });

    it("returns error when no local store path configured", () => {
      const result = kitService.getKitDeleteSummary({}, "A0");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });
  });
});

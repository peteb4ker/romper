import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock database operations
vi.mock("../../db/romperDbCoreORM.js", () => ({
  addKit: vi.fn(),
  getKit: vi.fn(),
}));

import { addKit, getKit } from "../../db/romperDbCoreORM.js";
import { KitService } from "../kitService.js";

const mockPath = vi.mocked(path);
const mockAddKit = vi.mocked(addKit);
const mockGetKit = vi.mocked(getKit);

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
          name: "A5",
          bank_letter: "A",
          alias: null,
          editable: true,
          locked: false,
          step_pattern: null,
          modified_since_sync: false,
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
        success: true,
        data: { name: "A5", bank_letter: "A" },
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
          name: "K7",
          bank_letter: "K",
        }),
      );
    });
  });

  describe("copyKit", () => {
    const sourceKitData = {
      name: "A1",
      bank_letter: "A",
      alias: "Original Kit",
      editable: false,
      locked: true,
      step_pattern: "1010101010101010",
      modified_since_sync: true,
    };

    beforeEach(() => {
      mockGetKit.mockImplementation((dbPath: string, kitName: string) => {
        if (kitName === "A1") {
          return { success: true, data: sourceKitData };
        }
        return { success: false }; // Destination doesn't exist
      });
    });

    it("successfully copies an existing kit", () => {
      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(true);
      expect(mockGetKit).toHaveBeenCalledWith("/test/path/.romperdb", "A1"); // Check source exists
      expect(mockGetKit).toHaveBeenCalledWith("/test/path/.romperdb", "B2"); // Check dest doesn't exist
      expect(mockAddKit).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        expect.objectContaining({
          name: "B2",
          bank_letter: "B",
          alias: "B2", // Destination kit name as alias
          editable: true, // Always editable for copied kits
          locked: false, // Always unlocked for copied kits
          step_pattern: "1010101010101010", // Copied from source
          modified_since_sync: false, // Reset for new kit
        }),
      );
    });

    it("rejects invalid source kit slot", () => {
      expect(() => {
        kitService.copyKit(mockInMemorySettings, "invalid", "B2");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("rejects invalid destination kit slot", () => {
      expect(() => {
        kitService.copyKit(mockInMemorySettings, "A1", "invalid");
      }).toThrow("Invalid kit slot. Use format A0-Z99.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("rejects if source kit does not exist", () => {
      mockGetKit.mockImplementation((dbPath: string, kitName: string) => {
        return { success: false }; // Source doesn't exist
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Source kit does not exist.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("rejects if destination kit already exists", () => {
      mockGetKit.mockImplementation((dbPath: string, kitName: string) => {
        if (kitName === "A1") {
          return { success: true, data: sourceKitData };
        }
        if (kitName === "B2") {
          return { success: true, data: { name: "B2" } }; // Destination exists
        }
        return { success: false };
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Destination kit already exists.");
      expect(mockAddKit).not.toHaveBeenCalled();
    });

    it("returns error when no local store path configured", () => {
      const result = kitService.copyKit({}, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("handles database errors gracefully", () => {
      mockAddKit.mockReturnValue({
        success: false,
        error: "Database connection failed",
      });

      const result = kitService.copyKit(mockInMemorySettings, "A1", "B2");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Failed to duplicate kit: Database connection failed",
      );
    });
  });
});

import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs");
vi.mock("path");

import { rtfFileService } from "../rtfFileService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe("rtfFileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("writeRtfFile", () => {
    it("should remove existing RTF files and write a new one", () => {
      mockFs.readdirSync.mockReturnValue([
        "A - Old Artist.rtf" as unknown as fs.Dirent,
      ]);

      rtfFileService.writeRtfFile("/store", "A", "New Artist");

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(
        "/store/A - Old Artist.rtf",
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/store/A - New Artist.rtf",
        "{\\rtf1}",
        "utf-8",
      );
    });

    it("should write RTF file when no existing file", () => {
      mockFs.readdirSync.mockReturnValue([]);

      rtfFileService.writeRtfFile("/store", "B", "My Artist");

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/store/B - My Artist.rtf",
        "{\\rtf1}",
        "utf-8",
      );
    });
  });

  describe("removeRtfFile", () => {
    it("should remove matching RTF file for bank letter", () => {
      mockFs.readdirSync.mockReturnValue([
        "A - Artist.rtf" as unknown as fs.Dirent,
        "B - Other.rtf" as unknown as fs.Dirent,
      ]);

      rtfFileService.removeRtfFile("/store", "A");

      expect(mockFs.unlinkSync).toHaveBeenCalledWith("/store/A - Artist.rtf");
      expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it("should not remove files for other bank letters", () => {
      mockFs.readdirSync.mockReturnValue([
        "B - Other.rtf" as unknown as fs.Dirent,
      ]);

      rtfFileService.removeRtfFile("/store", "A");

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe("writeAllBankRtfFiles", () => {
    it("should write RTF files for banks with artist names", () => {
      mockFs.readdirSync.mockReturnValue([]);

      const banks = [
        {
          artist: "Artist A",
          letter: "A",
          rtf_filename: null,
          scanned_at: null,
        },
        { artist: null, letter: "B", rtf_filename: null, scanned_at: null },
        {
          artist: "Artist C",
          letter: "C",
          rtf_filename: null,
          scanned_at: null,
        },
      ];

      const written = rtfFileService.writeAllBankRtfFiles("/sd", banks);

      expect(written).toBe(2);
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it("should return 0 when no banks have artists", () => {
      const banks = [
        { artist: null, letter: "A", rtf_filename: null, scanned_at: null },
      ];

      const written = rtfFileService.writeAllBankRtfFiles("/sd", banks);

      expect(written).toBe(0);
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});

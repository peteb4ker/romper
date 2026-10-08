import * as fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sampleAudioVersion,
  SampleMetadataService,
} from "../sampleMetadataService.js";

vi.mock("../../../db/operations/sampleSourceQueries.js", () => ({
  getSlotSourcePath: vi.fn(),
}));

vi.mock("../../../utils/fileSystemUtils.js", () => ({
  ServicePathManager: {
    getDbPath: vi.fn((p: string) => `${p}/.romperdb`),
    getLocalStorePath: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  promises: { open: vi.fn() },
}));

import { getSlotSourcePath } from "../../../db/operations/sampleSourceQueries.js";
import { ServicePathManager } from "../../../utils/fileSystemUtils.js";

const STATS = {
  ino: 7n,
  mtimeNs: 1_700_000_000_123_456_789n,
  size: 15n,
} as unknown as fs.BigIntStats;

/** An open file handle over `contents`, with STATS */
function fileHandle(contents: Buffer) {
  return {
    close: vi.fn(async () => {}),
    readFile: vi.fn(async () => contents),
    stat: vi.fn(async () => STATS),
  };
}

describe("[Q-01] SampleMetadataService", () => {
  let service: SampleMetadataService;
  const mockSettings = { localStorePath: "/mock/store" };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SampleMetadataService();
    vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(
      "/mock/store",
    );
  });

  describe("getSampleAudioBuffer", () => {
    it("returns error when no local store path configured", async () => {
      vi.mocked(ServicePathManager.getLocalStorePath).mockReturnValue(null);

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("returns error when the slot can't be looked up", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        error: "DB error",
        success: false,
      });

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to get samples for kit A0");
    });

    it("returns null for an empty slot without opening a file", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: null,
        success: true,
      });

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
      );

      expect(result).toEqual({ data: null, success: true });
      expect(fs.promises.open).not.toHaveBeenCalled();
    });

    it("looks up only the one slot (RE-83)", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: null,
        success: true,
      });

      await service.getSampleAudioBuffer(mockSettings, "A0", 2, 3);

      expect(getSlotSourcePath).toHaveBeenCalledWith(
        "/mock/store/.romperdb",
        "A0",
        2,
        3,
      );
    });

    it("reads the slot's file and names its version", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: "/mock/store/A0/kick.wav",
        success: true,
      });
      const handle = fileHandle(Buffer.from("fake audio data"));
      vi.mocked(fs.promises.open).mockResolvedValue(
        handle as unknown as fs.promises.FileHandle,
      );

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
      );

      expect(result.success).toBe(true);
      expect(result.data?.bytes?.byteLength).toBe(15);
      expect(result.data?.version).toBe(
        sampleAudioVersion("/mock/store/A0/kick.wav", STATS),
      );
      expect(fs.promises.open).toHaveBeenCalledWith(
        "/mock/store/A0/kick.wav",
        "r",
      );
      expect(handle.close).toHaveBeenCalled();
    });

    it("doesn't read a file that's still the version the caller holds (#478)", async () => {
      const file = "/mock/store/A0/kick.wav";
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: file,
        success: true,
      });
      const handle = fileHandle(Buffer.from("fake audio data"));
      vi.mocked(fs.promises.open).mockResolvedValue(
        handle as unknown as fs.promises.FileHandle,
      );
      const known = sampleAudioVersion(file, STATS);

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
        known,
      );

      expect(result).toEqual({
        data: { bytes: null, version: known },
        success: true,
      });
      expect(handle.readFile).not.toHaveBeenCalled();
      expect(handle.close).toHaveBeenCalled();
    });

    it("reads the file when the caller holds another version", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: "/mock/store/A0/kick.wav",
        success: true,
      });
      const handle = fileHandle(Buffer.from("new audio"));
      vi.mocked(fs.promises.open).mockResolvedValue(
        handle as unknown as fs.promises.FileHandle,
      );

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
        "15:1:7:/mock/store/A0/kick.wav",
      );

      expect(result.data?.bytes?.byteLength).toBe(9);
      expect(handle.readFile).toHaveBeenCalled();
    });

    it("returns error when the file can't be opened", async () => {
      vi.mocked(getSlotSourcePath).mockReturnValue({
        data: "/nonexistent.wav",
        success: true,
      });
      vi.mocked(fs.promises.open).mockRejectedValue(
        new Error("ENOENT: no such file"),
      );

      const result = await service.getSampleAudioBuffer(
        mockSettings,
        "A0",
        1,
        0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read sample audio");
    });
  });

  describe("sampleAudioVersion", () => {
    it("changes with the file's path, size, modification time and inode", () => {
      const base = sampleAudioVersion("/a.wav", STATS);
      const changed = (patch: Partial<Record<keyof typeof STATS, bigint>>) =>
        sampleAudioVersion("/a.wav", {
          ...STATS,
          ...patch,
        } as fs.BigIntStats);

      expect(sampleAudioVersion("/b.wav", STATS)).not.toBe(base);
      expect(changed({ size: 16n })).not.toBe(base);
      expect(changed({ mtimeNs: STATS.mtimeNs + 1n })).not.toBe(base);
      expect(changed({ ino: 8n })).not.toBe(base);
      expect(changed({})).toBe(base);
    });
  });
});

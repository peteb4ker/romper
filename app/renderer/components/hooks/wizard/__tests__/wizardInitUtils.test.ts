import { describe, expect, it, vi } from "vitest";

import type { ElectronAPI } from "../../../../electron.d";

import {
  getElectronAPI,
  normalizeErrorMessage,
  runPreChecks,
} from "../wizardInitUtils";

describe("wizardInitUtils", () => {
  describe("normalizeErrorMessage", () => {
    it("maps premature close to an actionable download message", () => {
      expect(normalizeErrorMessage("premature close")).toContain(
        "Download failed",
      );
    });

    it("passes other messages through unchanged", () => {
      expect(normalizeErrorMessage("disk on fire")).toBe("disk on fire");
    });
  });

  describe("getElectronAPI", () => {
    it("returns the global electronAPI when present", () => {
      expect(getElectronAPI()).toBe(globalThis.electronAPI);
    });
  });

  describe("runPreChecks", () => {
    const writable = vi
      .fn()
      .mockResolvedValue({ writable: true } as { writable: boolean });

    it("throws when the target path is not writable", async () => {
      const api = {
        checkPathWritable: vi.fn().mockResolvedValue({ writable: false }),
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/target", "squarp")).rejects.toThrow(
        "Cannot write to /target",
      );
    });

    it("throws with sizes when disk space is insufficient", async () => {
      const api = {
        checkDiskSpace: vi.fn().mockResolvedValue({
          availableBytes: 100 * 1024 * 1024,
          requiredBytes: 1024 * 1024 * 1024,
          sufficient: false,
        }),
        checkPathWritable: writable,
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/target", "squarp")).rejects.toThrow(
        "Need ~1024 MB but only 100 MB available",
      );
    });

    it("requires less space for sdcard than squarp", async () => {
      const checkDiskSpace = vi
        .fn()
        .mockResolvedValue({ sufficient: true } as { sufficient: boolean });
      const api = {
        checkDiskSpace,
        checkPathWritable: writable,
      } as unknown as ElectronAPI;

      await runPreChecks(api, "/target", "squarp");
      expect(checkDiskSpace).toHaveBeenLastCalledWith(
        "/target",
        1024 * 1024 * 1024,
      );

      await runPreChecks(api, "/target", "sdcard");
      expect(checkDiskSpace).toHaveBeenLastCalledWith(
        "/target",
        500 * 1024 * 1024,
      );
    });

    it("skips the disk space check for a blank store", async () => {
      const checkDiskSpace = vi.fn();
      const api = {
        checkDiskSpace,
        checkPathWritable: writable,
      } as unknown as ElectronAPI;

      await runPreChecks(api, "/target", "blank");
      expect(checkDiskSpace).not.toHaveBeenCalled();
    });

    it("skips checks the API does not provide", async () => {
      await expect(
        runPreChecks({} as ElectronAPI, "/target", "squarp"),
      ).resolves.toBeUndefined();
    });
  });
});

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

  describe("[UC-01] [UC-02] [UC-03] runPreChecks", () => {
    const writable = vi
      .fn()
      .mockResolvedValue({ writable: true } as { writable: boolean });

    it("asks main to approve the target before any other check (RE-03)", async () => {
      const requestLocalStoreAccess = vi
        .fn()
        .mockResolvedValue({ granted: true });
      // Main only probes a folder it has granted, so approval comes first
      const checkExistingLocalStore = vi
        .fn()
        .mockResolvedValue({ exists: false });
      const api = {
        checkExistingLocalStore,
        checkPathWritable: writable,
        requestLocalStoreAccess,
      } as unknown as ElectronAPI;

      await runPreChecks(api, "/typed/romper", "blank");
      expect(requestLocalStoreAccess).toHaveBeenCalledWith("/typed/romper");
      const approvedAt = requestLocalStoreAccess.mock.invocationCallOrder[0];
      expect(approvedAt).toBeLessThan(
        checkExistingLocalStore.mock.invocationCallOrder[0],
      );
      expect(approvedAt).toBeLessThan(
        writable.mock.invocationCallOrder.at(-1)!,
      );
    });

    it("stops with main's reason when the target isn't approved", async () => {
      const checkExistingLocalStore = vi.fn();
      const checkPathWritable = vi.fn();
      const api = {
        checkExistingLocalStore,
        checkPathWritable,
        requestLocalStoreAccess: vi.fn().mockResolvedValue({
          error: "Romper wasn't given permission to use /typed/romper.",
          granted: false,
        }),
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/typed/romper", "blank")).rejects.toThrow(
        "Romper wasn't given permission to use /typed/romper.",
      );
      expect(checkExistingLocalStore).not.toHaveBeenCalled();
      expect(checkPathWritable).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when main gives no reason", async () => {
      const api = {
        requestLocalStoreAccess: vi.fn().mockResolvedValue({ granted: false }),
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/typed", "blank")).rejects.toThrow(
        "Romper wasn't given permission to use /typed",
      );
    });

    it("refuses a target that already holds a local store before the writability probe", async () => {
      const checkPathWritable = vi.fn();
      const api = {
        checkExistingLocalStore: vi.fn().mockResolvedValue({
          error: "Use Choose Existing Store",
          exists: true,
        }),
        checkPathWritable,
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/target", "blank")).rejects.toThrow(
        "Use Choose Existing Store",
      );
      // The writability probe writes a file; it must not run
      expect(checkPathWritable).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when main gives none", async () => {
      const api = {
        checkExistingLocalStore: vi.fn().mockResolvedValue({ exists: true }),
      } as unknown as ElectronAPI;

      await expect(runPreChecks(api, "/target", "blank")).rejects.toThrow(
        "already contains a Romper local store",
      );
    });

    it("passes a target without a local store", async () => {
      const api = {
        checkExistingLocalStore: vi.fn().mockResolvedValue({ exists: false }),
        checkPathWritable: writable,
      } as unknown as ElectronAPI;

      await expect(
        runPreChecks(api, "/target", "blank"),
      ).resolves.toBeUndefined();
    });

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

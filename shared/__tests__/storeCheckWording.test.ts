import { describe, expect, it } from "vitest";

import type { StoreCheckKitFinding } from "../electronApi";

import { createStoreCheckFinding } from "../../tests/factories/storeCheck.factory";
import {
  describeDrive,
  describeDriveNotConnected,
  describeDriveNotResponding,
  describeFolderMissing,
  describeKitBadge,
  describeKitsNeedAttention,
  describeMissingFiles,
  describeNewMissingFiles,
  describeStatusBarItem,
  describeUntrackedFiles,
  hasKitBadge,
  LIBRARY_CHECK_EMPTY,
  LIBRARY_CHECK_HEADINGS,
  summarizeStoreCheck,
} from "../storeCheckWording";

const finding = (overrides: Partial<StoreCheckKitFinding> = {}) =>
  createStoreCheckFinding({ kitName: "A3", ...overrides });

// The wording below is the maintainer's, approved on #824 (2026-10-30) in
// docs/developer/store-check.md ("Wording"). A change to it is a product
// decision.
describe("[UC-05] [Q-06] store check wording (#824)", () => {
  describe("the badge", () => {
    it("says how many sample files aren't found", () => {
      expect(describeKitBadge(finding({ missing: 2 }))).toBe(
        "2 sample files not found",
      );
    });

    it("says how many files in the folder aren't in the kit, and how to add them", () => {
      expect(describeKitBadge(finding({ untracked: ["a", "b", "c"] }))).toBe(
        "3 files in this kit's folder aren't in the kit. Scan the kit to add them.",
      );
    });

    it("says both when a kit has both", () => {
      expect(
        describeKitBadge(
          finding({ missing: 2, untracked: ["a.wav", "b.wav", "c.wav"] }),
        ),
      ).toBe(
        "2 sample files not found; 3 files in the folder aren't in the kit",
      );
    });

    it("says a read-only kit's folder is missing, when that is all there is", () => {
      expect(describeKitBadge(finding({ folderMissing: true }))).toBe(
        "A3's folder is missing from your library.",
      );
    });

    it("counts the files when the folder is missing too: its samples read as not found", () => {
      expect(
        describeKitBadge(finding({ folderMissing: true, missing: 4 })),
      ).toBe("4 sample files not found");
    });

    it("agrees with a count of one", () => {
      expect(describeMissingFiles(1)).toBe("1 sample file not found");
      expect(describeUntrackedFiles(1)).toBe(
        "1 file in this kit's folder isn't in the kit. Scan the kit to add it.",
      );
      expect(
        describeKitBadge(finding({ missing: 1, untracked: ["a.wav"] })),
      ).toBe("1 sample file not found; 1 file in the folder isn't in the kit");
    });

    it("is left off a kit with nothing to badge: a file that can't be read has the quarantine icon", () => {
      const unreadable = finding({ quarantined: true, unreadable: 1 });
      expect(describeKitBadge(unreadable)).toBeNull();
      expect(hasKitBadge(unreadable)).toBe(false);
      expect(describeKitBadge(finding())).toBeNull();
    });

    it("is left off a kit whose samples are on a drive that isn't connected or didn't respond", () => {
      expect(
        describeKitBadge(
          finding({
            notConnected: [{ samples: 3, volume: "/Volumes/SSD" }],
            notResponding: ["/Volumes/Slow"],
          }),
        ),
      ).toBeNull();
    });
  });

  describe("the notice", () => {
    it("names the status bar item by how many kits need attention", () => {
      expect(describeKitsNeedAttention(3)).toBe("3 kits need attention");
      expect(describeKitsNeedAttention(1)).toBe("1 kit needs attention");
    });

    it("tells once where the list is", () => {
      expect(describeNewMissingFiles(3)).toBe(
        "Romper found missing sample files in 3 kits. Open the list from the status bar.",
      );
      expect(describeNewMissingFiles(1)).toBe(
        "Romper found missing sample files in 1 kit. Open the list from the status bar.",
      );
    });

    it("names a kit with no folder", () => {
      expect(describeFolderMissing("A3")).toBe(
        "A3's folder is missing from your library.",
      );
    });
  });

  describe("the dialog and the status bar item (approved 2026-10-31)", () => {
    it("has the approved headings and empty line", () => {
      expect(LIBRARY_CHECK_HEADINGS).toEqual({
        missing: "Sample files not found",
        untracked: "Files not in the kit",
      });
      expect(LIBRARY_CHECK_EMPTY).toBe("No problems found.");
    });

    it("shows the kit count when kits need attention, even with drives", () => {
      expect(
        describeStatusBarItem(
          summarizeStoreCheck([
            finding({ missing: 1 }),
            finding({
              kitName: "B1",
              notConnected: [{ samples: 1, volume: "/Volumes/SSD" }],
            }),
          ]),
        ),
      ).toBe("1 kit needs attention");
    });

    it("shows the drive when that is all there is: not connected first", () => {
      const connected = { samples: 1, volume: "/Volumes/SSD" };
      expect(
        describeStatusBarItem(
          summarizeStoreCheck([
            finding({ notConnected: [connected], notResponding: ["/x"] }),
          ]),
        ),
      ).toBe("Drive not connected");
      expect(
        describeStatusBarItem(
          summarizeStoreCheck([finding({ notResponding: ["/Volumes/Slow"] })]),
        ),
      ).toBe("Drive not responding");
    });

    it("shows nothing when there is nothing to say", () => {
      expect(describeStatusBarItem(summarizeStoreCheck([]))).toBeNull();
      expect(
        describeStatusBarItem(
          summarizeStoreCheck([finding({ quarantined: true, unreadable: 1 })]),
        ),
      ).toBeNull();
    });
  });

  describe("drives", () => {
    it("names a drive that isn't connected, with what wasn't checked", () => {
      expect(
        describeDriveNotConnected({
          kits: 3,
          samples: 14,
          volume: "/Volumes/Samples SSD",
        }),
      ).toBe(
        `The drive "Samples SSD" isn't connected, so 14 samples in 3 kits weren't checked.`,
      );
      expect(
        describeDriveNotConnected({ kits: 1, samples: 1, volume: "/mnt/nas" }),
      ).toBe(
        `The drive "nas" isn't connected, so 1 sample in 1 kit wasn't checked.`,
      );
    });

    it("names a drive that didn't respond", () => {
      expect(describeDriveNotResponding("/Volumes/Samples SSD")).toBe(
        `The drive "Samples SSD" didn't respond, so some samples weren't checked.`,
      );
    });

    it.each([
      ["/Volumes/Samples SSD", "Samples SSD"],
      ["/media/pete/USB", "USB"],
      ["D:\\", "D:"],
      ["/", "/"],
    ])("calls %s %s", (volume, name) => {
      expect(describeDrive(volume)).toBe(name);
    });
  });

  describe("summarizeStoreCheck", () => {
    it("lists the kits with a badge in slot order, and totals each drive across kits", () => {
      const summary = summarizeStoreCheck([
        finding({
          kitName: "B1",
          notConnected: [{ samples: 3, volume: "/Volumes/SSD" }],
          untracked: ["1 x.wav"],
        }),
        finding({ kitName: "A10", missing: 1 }),
        finding({ kitName: "A2", missing: 2 }),
        finding({ kitName: "A5", quarantined: true, unreadable: 1 }),
        finding({
          kitName: "C0",
          notConnected: [
            { samples: 11, volume: "/Volumes/SSD" },
            { samples: 0, volume: "/Volumes/Empty" },
          ],
          notResponding: ["/Volumes/Slow"],
        }),
      ]);

      expect(summary.attention.map((kit) => kit.kitName)).toEqual([
        "A2",
        "A10",
        "B1",
      ]);
      expect(summary.notConnected).toEqual([
        { kits: 2, samples: 14, volume: "/Volumes/SSD" },
      ]);
      expect(summary.notResponding).toEqual(["/Volumes/Slow"]);
    });

    it("is empty when nothing was found", () => {
      expect(summarizeStoreCheck([])).toEqual({
        attention: [],
        notConnected: [],
        notResponding: [],
      });
    });
  });
});

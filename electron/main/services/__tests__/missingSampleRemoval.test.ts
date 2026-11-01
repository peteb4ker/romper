import type { Sample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  missing: [] as Partial<Sample>[],
  removeMissingSamplesTx: vi.fn(),
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
  putBackMissingSamplesTx: vi.fn(() => 3),
  readMissingSamplesTx: vi.fn(() => db.missing),
  removeMissingSamplesTx: db.removeMissingSamplesTx,
  withDb: (_dir: string, fn: (handle: unknown) => unknown) => {
    try {
      return { data: fn({}), success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  },
  withDbTransaction: (_dir: string, fn: (handle: unknown) => unknown) => ({
    data: fn({}),
    success: true,
  }),
}));

import { CardNotRespondingError } from "../cardWatchdog.js";
import {
  putBackMissingSamples,
  removeMissingSamples,
} from "../missingSampleRemoval.js";

const gone = () => Object.assign(new Error("gone"), { code: "ENOENT" });

/** What `stat` answers for each path; a path not listed is there */
let answers: Record<string, "back" | "denied" | "gone" | "hangs">;

describe("[UC-05] removeMissingSamples re-checks each file in main (#822)", () => {
  beforeEach(() => {
    answers = {};
    db.removeMissingSamplesTx.mockImplementation(
      (_db: unknown, _kit: string, confirmed: unknown[]) => ({
        samples: confirmed.length,
        voicesBefore: [],
      }),
    );
    vi.spyOn(fs.promises, "stat").mockImplementation(((p: string) => {
      switch (answers[p]) {
        case "denied":
          return Promise.reject(
            Object.assign(new Error("denied"), { code: "EACCES" }),
          );
        case "gone":
          return Promise.reject(gone());
        case "hangs":
          return Promise.reject(new CardNotRespondingError());
        default:
          return Promise.resolve({} as fs.Stats);
      }
    }) as typeof fs.promises.stat);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("confirms only files still gone on a connected drive; a file that is back, unreadable to stat, on a gone drive or on a drive that didn't answer stays", async () => {
    db.missing = [
      { id: 1, source_path: "/store/A0/1 gone.wav" },
      { id: 2, source_path: "/store/A0/1 back.wav" },
      { id: 3, source_path: "/store/A0/1 denied.wav" },
      { id: 4, source_path: "/Volumes/Away/a.wav" },
      { id: 5, source_path: "/Volumes/Away/b.wav" },
      { id: 6, source_path: "/Volumes/Slow/a.wav" },
      { id: 7, source_path: "/Volumes/Slow/b.wav" },
    ];
    answers = {
      "/store/A0/1 denied.wav": "denied",
      "/store/A0/1 gone.wav": "gone",
      "/Volumes/Away": "gone",
      "/Volumes/Away/a.wav": "gone",
      "/Volumes/Away/b.wav": "gone",
      "/Volumes/Slow/a.wav": "hangs",
      "/Volumes/Slow/b.wav": "gone",
    };

    const result = await removeMissingSamples("/store", "A0");

    expect(result).toEqual({
      data: { samples: 1, voicesBefore: [] },
      success: true,
    });
    expect(db.removeMissingSamplesTx).toHaveBeenCalledWith({}, "A0", [
      { id: 1, source_path: "/store/A0/1 gone.wav" },
    ]);
    const asked = vi.mocked(fs.promises.stat).mock.calls.map(([p]) => p);
    // The gone drive is asked about once; the slow drive's second file isn't
    // asked about at all
    expect(asked.filter((p) => p === "/Volumes/Away")).toHaveLength(1);
    expect(asked).not.toContain("/Volumes/Slow/b.wav");
  });

  it("says why when the kit can't be read", async () => {
    const { readMissingSamplesTx } =
      await import("../../db/romperDbCoreORM.js");
    vi.mocked(readMissingSamplesTx).mockImplementationOnce(() => {
      throw new Error("Kit Z9 not found");
    });

    expect(await removeMissingSamples("/store", "Z9")).toEqual({
      error: "Kit Z9 not found",
      success: false,
    });
    expect(db.removeMissingSamplesTx).not.toHaveBeenCalled();
  });

  it("puts back through one transaction and says how many rows", () => {
    expect(putBackMissingSamples("/store", "A0", [])).toEqual({
      data: { samples: 3, voicesBefore: [] },
      success: true,
    });
  });
});

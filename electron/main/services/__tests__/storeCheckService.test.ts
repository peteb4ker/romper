import type { Sample } from "@romper/shared/db/schema.js";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  names: ["A0", "A1", "B0"],
  rows: new Map<
    string,
    {
      editable: boolean;
      samples: Partial<Sample>[];
      voices: { stereo_mode: boolean; voice_number: number }[];
    }
  >(),
  updates: [] as { fields: object; id: number; path?: string }[],
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitNamesForCheck: vi.fn(() => ({ data: db.names, success: true })),
  readKitRowsToCheck: vi.fn((_db: unknown, kit: string) => db.rows.get(kit)),
  updateSampleSourceStatusTx: vi.fn(
    (_db: unknown, id: number, fields: object, path?: string) => {
      db.updates.push({ fields, id, path });
      // The store now holds what was recorded
      for (const rows of db.rows.values()) {
        for (const sample of rows.samples) {
          if (sample.id === id) Object.assign(sample, fields);
        }
      }
      return true;
    },
  ),
  withDb: vi.fn((_dir: string, fn: (d: unknown) => unknown) => ({
    data: fn({}),
    success: true,
  })),
  withDbTransaction: vi.fn((_dir: string, fn: (d: unknown) => unknown) => ({
    data: fn({}),
    success: true,
  })),
}));

const scan = vi.hoisted(() => ({
  check: vi.fn(),
}));

// The folder side lists each read-only kit's folder with fs.promises (#820)
const files = vi.hoisted(() => ({
  readdir: vi.fn(),
  stat: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const promises = {
    ...actual.promises,
    readdir: files.readdir,
    stat: files.stat,
  };
  return { ...actual, default: { ...actual, promises }, promises };
});
vi.mock("../scanService.js", () => ({
  changedChecks: (
    found: {
      fields: Record<string, unknown>;
      sample: Record<string, unknown>;
    }[],
  ) =>
    found.filter(({ fields, sample }) =>
      Object.entries(fields).some(([key, value]) => sample[key] !== value),
    ),
  checkSampleFile: scan.check,
}));

import { IpcActivity } from "../../ipcActivity.js";
import {
  StoreCheckService,
  storeCheckSettings,
  volumeOf,
} from "../storeCheckService.js";

const SETTINGS = { ...storeCheckSettings };

/** A finding with nothing in it, to spread the one thing a test expects */
const CLEAN = {
  folderMissing: false,
  kitName: "",
  missing: 0,
  quarantined: false,
  unavailableVolumes: [],
  unreadable: 0,
  untracked: [],
};

/** The checks find each file readable, unless `problems` says otherwise */
function filesFind(problems: Record<string, "missing" | "unreadable"> = {}) {
  scan.check.mockImplementation((row: Sample) =>
    Promise.resolve({
      fields: { source_status: problems[row.source_path] ?? "readable" },
      sample: row,
    }),
  );
}

/** A sample row as the store check reads it */
function sample(
  id: number,
  filePath: string,
  status: null | string = null,
): Partial<Sample> {
  return {
    id,
    source_path: filePath,
    source_status: status as Sample["source_status"],
    voice_number: 1,
  };
}

describe("[UC-05] [Q-01] StoreCheckService schedules the background check (#812)", () => {
  let activity: IpcActivity;
  let service: StoreCheckService;
  let pushed: { kits: unknown[]; state: string }[];

  /** Let the pass run for `ms` of fake time */
  const run = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  const checkedFiles = () =>
    scan.check.mock.calls.map(([row]) => (row as Sample).source_path);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    Object.assign(storeCheckSettings, SETTINGS, {
      operationTimeoutMs: 1000,
      pollMs: 10,
      quietMs: 20,
      startupQuietMs: 500,
    });
    db.names = ["A0", "A1", "B0"];
    db.rows = new Map(
      db.names.map((kit) => [
        kit,
        {
          editable: true,
          samples: [
            sample(db.names.indexOf(kit) * 10 + 1, `/lib/${kit}/1.wav`),
          ],
          voices: [{ stereo_mode: false, voice_number: 1 }],
        },
      ]),
    );
    db.updates = [];
    scan.check.mockReset();
    files.readdir.mockReset();
    files.stat.mockReset();
    filesFind();
    activity = new IpcActivity();
    service = new StoreCheckService(activity);
    pushed = [];
    service.onUpdate((update) => pushed.push(update));
  });

  afterEach(() => {
    service.cancel();
    Object.assign(storeCheckSettings, SETTINGS);
    vi.useRealTimers();
  });

  it("waits for a quiet startup before the first kit, then checks the kits in slot order, a kit per step", async () => {
    service.start("/lib");

    await run(499);
    expect(scan.check).not.toHaveBeenCalled();
    expect(service.getStatus().state).toBe("running");

    await run(500);
    expect(checkedFiles()).toEqual([
      "/lib/A0/1.wav",
      "/lib/A1/1.wav",
      "/lib/B0/1.wav",
    ]);
    expect(service.getStatus().state).toBe("idle");
    expect(service.getStatus().lastCompletedAt).not.toBeNull();
  });

  it("yields to a call in flight: nothing is checked until none has run for a quiet period", async () => {
    let finish!: () => void;
    const call = activity.track(
      "get-all-kits",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    service.start("/lib");

    await run(60_000);
    expect(scan.check).not.toHaveBeenCalled();
    // Waiting for a call to finish isn't a pause for a write
    expect(service.getStatus().state).toBe("running");

    finish();
    await call;
    await run(storeCheckSettings.startupQuietMs - 1);
    expect(scan.check).not.toHaveBeenCalled();
    await run(2);
    expect(scan.check).toHaveBeenCalledTimes(1);
  });

  it("goes first to a call that arrives while a kit is checked: the next kit waits for it", async () => {
    let finish!: () => void;
    let call: Promise<void> | undefined;
    scan.check.mockImplementation((row: Sample) => {
      if (row.source_path === "/lib/A0/1.wav" && !call) {
        call = activity.track(
          "get-kit",
          () =>
            new Promise<void>((resolve) => {
              finish = resolve;
            }),
        );
      }
      return Promise.resolve({
        fields: { source_status: "readable" },
        sample: row,
      });
    });
    service.start("/lib");

    await run(10_000);
    expect(checkedFiles()).toEqual(["/lib/A0/1.wav"]);

    finish();
    await call;
    await run(1000);
    expect(checkedFiles()).toEqual([
      "/lib/A0/1.wav",
      "/lib/A1/1.wav",
      "/lib/B0/1.wav",
    ]);
  });

  it("pauses while a write is in flight, and carries on after it", async () => {
    let finish!: () => void;
    const write = activity.track(
      "startKitSync",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    service.start("/lib");

    await run(60_000);
    expect(scan.check).not.toHaveBeenCalled();
    expect(service.getStatus().state).toBe("paused");

    finish();
    await write;
    await run(1000);
    expect(scan.check).toHaveBeenCalledTimes(3);
    expect(service.getStatus().state).toBe("idle");
  });

  it("checks a kit again, and records nothing, if a write started while it was checked", async () => {
    let started = false;
    scan.check.mockImplementation((row: Sample) => {
      if (row.source_path === "/lib/A0/1.wav" && !started) {
        started = true;
        activity.track(
          "startKitSync",
          () => new Promise<void>(() => undefined),
        );
      }
      return Promise.resolve({
        fields: { source_status: "missing" },
        sample: row,
      });
    });
    service.start("/lib");

    await run(5000);

    // Found missing, but the write began meanwhile: not recorded
    expect(db.updates).toEqual([]);
    expect(pushed).toEqual([]);
  });

  it("a store change cancels the pass: nothing more is checked or recorded", async () => {
    let resolveCheck!: () => void;
    scan.check.mockImplementation(
      (row: Sample) =>
        new Promise((resolve) => {
          resolveCheck = () =>
            resolve({ fields: { source_status: "missing" }, sample: row });
        }),
    );
    service.start("/lib");
    await run(600);
    expect(scan.check).toHaveBeenCalledTimes(1);

    service.cancel();
    resolveCheck();
    await run(5000);

    expect(scan.check).toHaveBeenCalledTimes(1);
    expect(db.updates).toEqual([]);
    expect(service.getStatus()).toEqual({
      kits: [],
      lastCompletedAt: null,
      state: "idle",
    });
  });

  it("starts again on a different store, but not twice on the same one", async () => {
    service.start("/lib");
    await run(1000);
    expect(scan.check).toHaveBeenCalledTimes(3);

    service.start("/lib");
    await run(1000);
    expect(scan.check).toHaveBeenCalledTimes(3);

    service.start("/other");
    await run(1000);
    expect(scan.check).toHaveBeenCalledTimes(6);
  });

  describe("window focus (D7)", () => {
    const TEN_MINUTES = 10 * 60 * 1000;

    async function completedPass() {
      service.start("/lib");
      await run(1000);
      expect(scan.check).toHaveBeenCalledTimes(3);
      expect(service.getStatus().state).toBe("idle");
    }

    it("checks the store again when the last pass ended over 10 minutes ago", async () => {
      await completedPass();

      await run(TEN_MINUTES + 1);
      service.refreshIfStale();
      await run(1000);

      expect(scan.check).toHaveBeenCalledTimes(6);
      expect(service.getStatus().state).toBe("idle");
    });

    it("does nothing when the last pass ended 10 minutes ago or less", async () => {
      await completedPass();

      await run(TEN_MINUTES - 2000);
      service.refreshIfStale();
      await run(1000);
      service.refreshIfStale();
      await run(5000);

      expect(scan.check).toHaveBeenCalledTimes(3);
    });

    it("counts the 10 minutes from the end of the latest pass, so a focus soon after a refresh does nothing", async () => {
      await completedPass();
      await run(TEN_MINUTES + 1);
      service.refreshIfStale();
      await run(1000);
      expect(scan.check).toHaveBeenCalledTimes(6);

      service.refreshIfStale();
      await run(5000);

      expect(scan.check).toHaveBeenCalledTimes(6);
    });

    it("does not start a second pass while one is running", async () => {
      await completedPass();
      await run(TEN_MINUTES + 1);
      service.refreshIfStale();
      expect(service.getStatus().state).toBe("running");

      service.refreshIfStale();
      service.refreshIfStale();
      await run(1000);

      expect(scan.check).toHaveBeenCalledTimes(6);
    });

    it("does not start while a write, setup or rescan is in flight", async () => {
      await completedPass();
      let finish!: () => void;
      const write = activity.track(
        "setup-import-kit",
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      await run(TEN_MINUTES + 1);

      service.refreshIfStale();
      await run(5000);
      expect(scan.check).toHaveBeenCalledTimes(3);
      expect(service.getStatus().state).toBe("idle");

      finish();
      await write;
      service.refreshIfStale();
      await run(1000);
      expect(scan.check).toHaveBeenCalledTimes(6);
    });

    it("does nothing before a first pass has completed, or after a store change", async () => {
      service.refreshIfStale();
      await run(TEN_MINUTES);
      expect(scan.check).not.toHaveBeenCalled();

      await completedPass();
      service.cancel();
      await run(TEN_MINUTES + 1);
      service.refreshIfStale();
      await run(1000);
      expect(scan.check).toHaveBeenCalledTimes(3);
    });

    it("keeps the findings until the new pass changes them, and skips the startup wait", async () => {
      filesFind({ "/lib/A0/1.wav": "missing" });
      await completedPass();
      expect(service.getStatus().kits.map((k) => k.kitName)).toEqual(["A0"]);

      await run(TEN_MINUTES + 1);
      filesFind();
      scan.check.mockClear();
      service.refreshIfStale();
      expect(service.getStatus().kits.map((k) => k.kitName)).toEqual(["A0"]);
      await run(100);
      expect(scan.check).toHaveBeenCalled();
      await run(1000);
      expect(service.getStatus().kits).toEqual([]);
    });
  });

  it("leaves the kit open in the editor to its own check", async () => {
    service.noteKitOpened("A1");
    service.start("/lib");

    await run(1000);

    expect(checkedFiles()).toEqual(["/lib/A0/1.wav", "/lib/B0/1.wav"]);
  });

  it("records what changed against the row's id and the path it checked", async () => {
    filesFind({ "/lib/A1/1.wav": "missing" });
    service.start("/lib");

    await run(1000);

    expect(db.updates).toContainEqual({
      fields: { source_status: "missing" },
      id: 11,
      path: "/lib/A1/1.wav",
    });
  });

  it("pushes only the kits whose finding changed: silent when a file turns up readable", async () => {
    filesFind({ "/lib/A1/1.wav": "unreadable", "/lib/B0/1.wav": "missing" });
    service.start("/lib");

    await run(1000);

    // A0 went from never checked to readable: no finding changed
    expect(pushed.flatMap((update) => update.kits)).toEqual([
      { ...CLEAN, kitName: "A1", quarantined: true, unreadable: 1 },
      { ...CLEAN, kitName: "B0", missing: 1 },
    ]);
    expect(service.getStatus().kits.map((kit) => kit.kitName)).toEqual([
      "A1",
      "B0",
    ]);
  });

  it("sends nothing for a kit that was already found and still is", async () => {
    db.rows.get("A1")!.samples[0].source_status = "unreadable";
    filesFind({ "/lib/A1/1.wav": "unreadable" });
    service.start("/lib");

    await run(1000);

    expect(pushed).toEqual([]);
    // It is still in the status
    expect(service.getStatus().kits).toEqual([
      { ...CLEAN, kitName: "A1", quarantined: true, unreadable: 1 },
    ]);
  });

  it("sends a kit that's clean again with zero counts, and drops it from the status", async () => {
    db.rows.get("A1")!.samples[0].source_status = "unreadable";
    service.start("/lib");

    await run(1000);

    expect(pushed.flatMap((update) => update.kits)).toEqual([
      { ...CLEAN, kitName: "A1" },
    ]);
    expect(service.getStatus().kits).toEqual([]);
  });

  it("gives each file operation a time limit, and skips the rest of a volume that timed out", async () => {
    db.names = ["A0", "A1"];
    db.rows.set("A0", {
      editable: true,
      samples: [
        sample(1, "/Volumes/Slow/a.wav"),
        sample(2, "/Volumes/Slow/b.wav"),
        sample(3, "/lib/c.wav"),
      ],
      voices: [{ stereo_mode: false, voice_number: 1 }],
    });
    db.rows.set("A1", {
      editable: true,
      samples: [sample(4, "/Volumes/Slow/d.wav"), sample(5, "/lib/e.wav")],
      voices: [{ stereo_mode: false, voice_number: 1 }],
    });
    // The stat on the first file never resolves: the limit gives up
    scan.check.mockImplementation(
      (row: Sample, limit: <T>(operation: Promise<T>) => Promise<T>) =>
        row.source_path === "/Volumes/Slow/a.wav"
          ? limit(new Promise(() => undefined))
          : Promise.resolve({
              fields: { source_status: "readable" },
              sample: row,
            }),
    );
    service.start("/lib");

    await run(600);
    expect(checkedFiles()).toEqual(["/Volumes/Slow/a.wav"]);
    // The limit gives up on it after operationTimeoutMs
    await run(1000);

    // The slow volume's other files are skipped, here and in the next kit;
    // the pass goes on to the files on other volumes
    expect(checkedFiles()).toEqual([
      "/Volumes/Slow/a.wav",
      "/lib/c.wav",
      "/lib/e.wav",
    ]);
    expect(db.updates.map((update) => update.id).sort()).toEqual([3, 5]);
    expect(service.getStatus().state).toBe("idle");
  });

  it("a limit that rejects with anything else skips only that file", async () => {
    db.names = ["A0"];
    db.rows.set("A0", {
      editable: true,
      samples: [sample(1, "/lib/a.wav"), sample(2, "/lib/b.wav")],
      voices: [{ stereo_mode: false, voice_number: 1 }],
    });
    scan.check.mockImplementation((row: Sample) =>
      row.source_path === "/lib/a.wav"
        ? Promise.reject(new Error("unexpected"))
        : Promise.resolve({
            fields: { source_status: "readable" },
            sample: row,
          }),
    );
    service.start("/lib");

    await run(1000);

    expect(checkedFiles()).toEqual(["/lib/a.wav", "/lib/b.wav"]);
    expect(db.updates.map((update) => update.id)).toEqual([2]);
  });

  describe("[UC-05] kit folders (#820, stage 2)", () => {
    const enoent = () =>
      Object.assign(new Error("no such file"), { code: "ENOENT" });
    /** What each folder holds; a folder not listed is gone */
    let folders: Record<string, string[]>;
    const listed = () => files.readdir.mock.calls.map(([dir]) => dir);

    beforeEach(() => {
      folders = {};
      files.readdir.mockImplementation((dir: string) =>
        dir in folders
          ? Promise.resolve(folders[dir])
          : Promise.reject(enoent()),
      );
      // The drive the store is on is there
      files.stat.mockResolvedValue({});
      db.rows.get("A1")!.editable = false;
    });

    it("lists a voice-prefixed WAV in a read-only kit's folder that no row points at", async () => {
      folders["/lib/A1"] = ["1.wav", "2 dropped.wav", "3 SNARE.WAV"];
      service.start("/lib");

      await run(1000);

      expect(service.getStatus().kits).toEqual([
        {
          ...CLEAN,
          kitName: "A1",
          untracked: ["2 dropped.wav", "3 SNARE.WAV"],
        },
      ]);
      expect(pushed.flatMap((update) => update.kits)).toEqual(
        service.getStatus().kits,
      );
    });

    it("never counts a hidden file, an AppleDouble file, a non-WAV or a name with no voice prefix", async () => {
      folders["/lib/A1"] = [
        "1.wav",
        "._2 dropped.wav",
        ".DS_Store",
        ".1 hidden.wav",
        "notes.txt",
        "kick.wav",
        "5 high.wav",
        "2 dropped.wav.bak",
      ];
      service.start("/lib");

      await run(1000);

      expect(service.getStatus().kits).toEqual([]);
      expect(pushed).toEqual([]);
    });

    it("leaves an editable kit's folder alone: it isn't listed or reported", async () => {
      folders["/lib/A0"] = ["1.wav", "2 extra.wav"];
      folders["/lib/A1"] = ["1.wav"];
      service.start("/lib");

      await run(1000);

      expect(listed()).toEqual(["/lib/A1"]);
      expect(service.getStatus().kits).toEqual([]);
    });

    it("reports a read-only kit whose folder is gone", async () => {
      service.start("/lib");

      await run(1000);

      expect(service.getStatus().kits).toEqual([
        { ...CLEAN, folderMissing: true, kitName: "A1" },
      ]);
    });

    it("counts a missing folder on a drive that isn't connected as the drive, not as a missing folder", async () => {
      files.stat.mockImplementation((target: string) =>
        target === "/Volumes/Samples SSD"
          ? Promise.reject(enoent())
          : Promise.resolve({}),
      );
      service.start("/Volumes/Samples SSD/lib");

      await run(1000);

      expect(service.getStatus().kits).toEqual([
        {
          ...CLEAN,
          kitName: "A1",
          unavailableVolumes: ["/Volumes/Samples SSD"],
        },
      ]);
    });

    it("skips the rest of a volume whose folder listing times out, and says so", async () => {
      db.rows.get("B0")!.editable = false;
      files.readdir.mockImplementation(() => new Promise(() => undefined));
      service.start("/Volumes/Slow/lib");

      await run(600);
      expect(listed()).toEqual(["/Volumes/Slow/lib/A1"]);
      await run(1000);

      // B0 isn't listed: its volume is already known not to respond
      expect(listed()).toEqual(["/Volumes/Slow/lib/A1"]);
      expect(service.getStatus().kits).toEqual([
        { ...CLEAN, kitName: "A1", unavailableVolumes: ["/Volumes/Slow"] },
        { ...CLEAN, kitName: "B0", unavailableVolumes: ["/Volumes/Slow"] },
      ]);
      expect(service.getStatus().state).toBe("idle");
    });

    it("keeps what it knew of a folder it couldn't read for any other reason", async () => {
      folders["/lib/A1"] = ["1.wav", "2 dropped.wav"];
      service.start("/lib");
      await run(1000);
      expect(service.getStatus().kits).toHaveLength(1);

      files.readdir.mockRejectedValue(
        Object.assign(new Error("denied"), { code: "EACCES" }),
      );
      await run(10 * 60 * 1000 + 1);
      service.refreshIfStale();
      await run(1000);

      expect(service.getStatus().kits).toEqual([
        { ...CLEAN, kitName: "A1", untracked: ["2 dropped.wav"] },
      ]);
    });

    it("sends a kit that's clean again with an empty list, when the file is gone or the kit becomes editable", async () => {
      folders["/lib/A1"] = ["1.wav", "2 dropped.wav"];
      service.start("/lib");
      await run(1000);
      expect(service.getStatus().kits).toHaveLength(1);

      folders["/lib/A1"] = ["1.wav"];
      await run(10 * 60 * 1000 + 1);
      service.refreshIfStale();
      await run(1000);

      expect(pushed.at(-1)?.kits).toEqual([{ ...CLEAN, kitName: "A1" }]);
      expect(service.getStatus().kits).toEqual([]);
    });

    it("lists no folder the database has no kit for: a deleted imported kit's folder is left alone", async () => {
      // A2's kit was deleted; its folder stays in the store
      folders["/lib/A2"] = ["1.wav", "2 left behind.wav"];
      folders["/lib/A1"] = ["1.wav"];
      service.start("/lib");

      await run(1000);

      expect(listed()).toEqual(["/lib/A1"]);
      expect(service.getStatus().kits).toEqual([]);
    });

    it("carries a folder finding with the kit's file findings, in one push", async () => {
      folders["/lib/A1"] = ["1.wav", "2 dropped.wav"];
      filesFind({ "/lib/A1/1.wav": "missing" });
      service.start("/lib");

      await run(1000);

      expect(pushed.flatMap((update) => update.kits)).toEqual([
        { ...CLEAN, kitName: "A1", missing: 1, untracked: ["2 dropped.wav"] },
      ]);
    });
  });
});

describe("[Q-01] volumeOf: the drive a file is on (#812)", () => {
  it.each([
    ["/Volumes/Samples SSD/Drums/kick.wav", "/Volumes/Samples SSD"],
    ["/media/pete/USB/kick.wav", "/media/pete/USB"],
    ["/run/media/pete/USB/kick.wav", "/run/media/pete/USB"],
    ["/mnt/nas/kick.wav", "/mnt/nas"],
    ["/Users/pete/Music/kick.wav", "/"],
  ])("%s is on %s", (file, volume) => {
    expect(volumeOf(file)).toBe(volume);
  });
});

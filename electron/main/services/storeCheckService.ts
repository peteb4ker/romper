import type {
  StoreCheckKitFinding,
  StoreCheckStatus,
  StoreCheckUpdate,
} from "@romper/shared/electronApi.js";

import { compareKitSlots } from "@romper/shared/kitUtilsShared.js";
import { voiceOfCardFile } from "@romper/shared/rampleCardLayout.js";
import { isKitQuarantined } from "@romper/shared/stereoLinkRules.js";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  getKitNamesForCheck,
  type KitRowsToCheck,
  readKitRowsToCheck,
  updateSampleSourceStatusTx,
  withDb,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { type IpcActivity, ipcActivity } from "../ipcActivity.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { CardNotRespondingError, withCardWatchdog } from "./cardWatchdog.js";
import {
  changedChecks,
  checkSampleFile,
  type SampleCheck,
} from "./scanService.js";

/** How the store check paces itself; tests shorten these */
export const storeCheckSettings = {
  /**
   * How long one fs operation (a stat, a header read) may take. Past it the
   * file's volume is skipped for the rest of the pass.
   */
  operationTimeoutMs: 10_000,
  /** How often a waiting pass looks again for a quiet moment */
  pollMs: 100,
  /** No IPC call in flight, and none begun or ended, for this long */
  quietMs: 250,
  /**
   * A window gaining focus starts another pass once the last one ended this
   * long ago (D7 of docs/developer/store-check.md). No timer, no watcher.
   */
  refreshAfterMs: 10 * 60 * 1000,
  /** The same before the first kit of a pass: not while the app is starting */
  startupQuietMs: 2000,
};

/** The folder side of a kit's finding (#820) */
type FolderFinding = Pick<
  StoreCheckKitFinding,
  "folderMissing" | "unavailableVolumes" | "untracked"
>;

/** Nothing found in a folder: also what an editable kit's folder reports */
const NO_FOLDER_FINDING: FolderFinding = {
  folderMissing: false,
  unavailableVolumes: [],
  untracked: [],
};

/**
 * Checks that the store's sample files still match its database, in the
 * background, so a file deleted or broken on disk is found without opening
 * its kit (#812, stage 1 of docs/developer/store-check.md).
 *
 * One kit per step. A step reads the kit's rows, checks each sample's file
 * through the shared `checkSampleFile` (one async fs operation at a time,
 * each under a time limit), and records what changed in one transaction.
 * Before every step the pass yields to the event loop and waits for a quiet
 * moment with no IPC call in flight, so a user action always goes first; it
 * doesn't run during a write, setup or rescan, and drops a step's findings
 * if one began meanwhile. It never uses a sync fs call.
 *
 * A read-only kit's folder is listed too, in the same step (#820, stage 2):
 * voice-prefixed WAVs no row points at, and a folder that is gone, are
 * findings kept in memory. Editable kits' folders, and folders no kit
 * claims (an imported kit's leftovers), are never listed (D4).
 */
export class StoreCheckService {
  private readonly activity: IpcActivity;
  private controller: AbortController | null = null;
  /** Kits with a finding, as of their last check this pass */
  private readonly findings = new Map<string, StoreCheckKitFinding>();
  private lastCompletedAt: null | number = null;
  private listener: ((update: StoreCheckUpdate) => void) | null = null;
  /** The kit open in the editor, whose own kit-open check covers it */
  private openKit: null | string = null;
  /** Kits waiting for, or in, a re-check after a rescan (#821) */
  private readonly rechecking = new Set<string>();
  private state: StoreCheckStatus["state"] = "idle";
  /** The store this pass is for; null when none has started */
  private storePath: null | string = null;

  constructor(activity: IpcActivity = ipcActivity) {
    this.activity = activity;
  }

  /**
   * Stop the pass and forget its findings: the store changed, or the app
   * is quitting. Nothing more is recorded.
   */
  cancel(): void {
    this.reset();
    this.openKit = null;
  }

  /**
   * One step of a pass: check one kit's sample files, and its folder if it
   * is read-only, and record what changed. False if the step must run
   * again (a write, setup or rescan began meanwhile).
   */
  async checkKit(
    localStorePath: string,
    kitName: string,
    controller: AbortController = new AbortController(),
    slowVolumes: Set<string> = new Set(),
    drives: Map<string, boolean> = new Map(),
  ): Promise<boolean> {
    const dbDir = ServicePathManager.getDbPath(localStorePath);
    const started = this.activity.exclusiveStartCount;
    const read = withDb(dbDir, (db) => readKitRowsToCheck(db, kitName));
    if (!read.success || !read.data) return true;
    const rows = read.data;
    // What the renderer was last told of this kit (nothing, if this session
    // hasn't): a problem the database already held from an earlier session
    // is news to it (#824). The folder side isn't in the database: it is
    // what the last pass found.
    const before = this.findings.get(kitName) ?? cleanFinding(kitName);
    const known = folderPartOf(this.findings.get(kitName));
    // The kit list the renderer loaded shows the quarantine the database
    // held, so a kit that is no longer quarantined is news too (#812)
    const shownQuarantined = isKitQuarantined(rows.voices, rows.samples);

    const found = await this.checkFiles(rows, controller, slowVolumes, drives);
    const kitPath = path.join(localStorePath, kitName);
    const folder = rows.editable
      ? NO_FOLDER_FINDING
      : ((await this.checkFolder(kitPath, rows, controller, slowVolumes)) ??
        known);
    if (controller.signal.aborted) return true;
    // A write, setup or rescan began meanwhile: what was found may be out
    // of date, so check the kit again once it's over
    if (
      this.activity.exclusiveActive ||
      this.activity.exclusiveStartCount !== started
    ) {
      return false;
    }

    const changes = changedChecks(found);
    let after = this.findingOf(kitName, rows, drives, slowVolumes);
    if (changes.length > 0) {
      // The rows are read again in the transaction, so the finding is what
      // the store holds after the record
      const saved = withDbTransaction(dbDir, (db) => {
        for (const { fields, sample } of changes) {
          updateSampleSourceStatusTx(db, sample.id, fields, sample.source_path);
        }
        return this.findingOf(
          kitName,
          readKitRowsToCheck(db, kitName),
          drives,
          slowVolumes,
        );
      });
      if (saved.success && saved.data) after = saved.data;
    }
    const notResponding = this.slowVolumesOf(
      rows,
      rows.editable ? null : kitPath,
      slowVolumes,
    );
    this.report(
      before,
      { ...after, ...folder, notResponding },
      shownQuarantined,
    );
    return true;
  }

  getStatus(): StoreCheckStatus {
    return {
      kits: [...this.findings.values()].sort((a, b) =>
        compareKitSlots(a.kitName, b.kitName),
      ),
      lastCompletedAt: this.lastCompletedAt,
      state: this.state,
    };
  }

  /**
   * A kit was opened in the editor: its kit-open check covers it, so the
   * pass leaves it out. (Main isn't told when the editor closes; the next
   * kit opened takes its place.)
   */
  noteKitOpened(kitName: string): void {
    this.openKit = kitName;
  }

  /** Call `listener` with each step that changed a kit's finding */
  onUpdate(listener: (update: StoreCheckUpdate) => void): void {
    this.listener = listener;
  }

  /**
   * Check one kit now, outside the pass, once any write, setup or rescan in
   * flight is over: a rescan just changed the kit's rows and its folder, so
   * its finding is out of date (#821, stage 4). It records what changed and
   * pushes the kit if its finding did, as a step of the pass does, and
   * checks the kit open in the editor too. Does nothing before the pass for
   * this store has started (the pass will see the kit as the rescan left
   * it) and after a cancel.
   */
  recheckKit(kitName: string): void {
    const storePath = this.storePath;
    const controller = this.controller;
    if (storePath === null || controller === null) return;
    if (this.rechecking.has(kitName)) return;
    this.rechecking.add(kitName);
    void this.runRecheck(storePath, kitName, controller)
      .catch((error: unknown) => {
        console.warn(
          "[StoreCheck] Couldn't check the kit again:",
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => this.rechecking.delete(kitName));
  }

  /**
   * The window gained focus: start another pass over the same store if the
   * last one ended over `refreshAfterMs` ago (D7). Does nothing while a
   * pass is running, while a write, setup or rescan is in flight, or if no
   * pass has completed for the store. The findings stay as they were until
   * the new pass changes them, and the startup wait is skipped: the app
   * has been up for a while.
   */
  refreshIfStale(): void {
    if (
      this.storePath === null ||
      this.state !== "idle" ||
      this.lastCompletedAt === null ||
      this.activity.exclusiveActive ||
      Date.now() - this.lastCompletedAt <= storeCheckSettings.refreshAfterMs
    ) {
      return;
    }
    this.state = "running";
    const controller = new AbortController();
    this.controller = controller;
    void this.runPass(this.storePath, controller, 0);
  }

  /**
   * Start the pass for the store at `localStorePath`, once its kit grid has
   * loaded. Does nothing if this store's pass has already started, so a
   * renderer that reloads doesn't start another.
   */
  start(localStorePath: string): void {
    if (this.storePath === localStorePath) return;
    this.reset();
    this.storePath = localStorePath;
    this.state = "running";
    const controller = new AbortController();
    this.controller = controller;
    void this.runPass(localStorePath, controller);
  }

  /**
   * Check the kit's files one at a time, each under a time limit. A volume
   * that timed out is skipped from then on; a file whose check failed any
   * other way is left as it is.
   */
  private async checkFiles(
    rows: KitRowsToCheck,
    controller: AbortController,
    slowVolumes: Set<string>,
    drives: Map<string, boolean>,
  ): Promise<SampleCheck[]> {
    const limit = <T>(operation: Promise<T>) =>
      withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);
    const found: SampleCheck[] = [];
    for (const sample of rows.samples) {
      if (controller.signal.aborted) break;
      const volume = volumeOf(sample.source_path);
      if (slowVolumes.has(volume)) continue;
      try {
        // One operation at a time: never Promise.all
        const check = await checkSampleFile(sample, limit); // NOSONAR: one fs operation at a time on purpose
        found.push(check);
        if (check.fields.source_status === "missing") {
          await this.noteDrive(volume, drives, limit); // NOSONAR: one fs operation at a time on purpose
        }
      } catch (error) {
        if (error instanceof CardNotRespondingError) slowVolumes.add(volume);
      }
    }
    return found;
  }

  /**
   * List a read-only kit's folder, under the same time limit as the files,
   * and find what is wrong with it. Null if it couldn't be told (any
   * failure other than the folder being gone), so the last finding stands.
   */
  private async checkFolder(
    kitPath: string,
    rows: KitRowsToCheck,
    controller: AbortController,
    slowVolumes: Set<string>,
  ): Promise<FolderFinding | null> {
    const volume = volumeOf(kitPath);
    if (controller.signal.aborted) return null;
    if (slowVolumes.has(volume)) return unavailable(volume);
    const limit = <T>(operation: Promise<T>) =>
      withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);
    try {
      const names = await limit(fs.promises.readdir(kitPath));
      const tracked = new Set(rows.samples.map((row) => row.source_path));
      return {
        ...NO_FOLDER_FINDING,
        untracked: names
          .filter(isKitWav)
          .filter((name) => !tracked.has(path.join(kitPath, name)))
          .sort((a, b) => a.localeCompare(b)),
      };
    } catch (error) {
      if (error instanceof CardNotRespondingError) {
        slowVolumes.add(volume);
        return unavailable(volume);
      }
      if (!isGone(error)) return null;
    }
    // The folder is gone: or is it the drive that isn't there (D6)?
    try {
      await limit(fs.promises.stat(volume));
    } catch (error) {
      if (error instanceof CardNotRespondingError) {
        slowVolumes.add(volume);
        return unavailable(volume);
      }
      return isGone(error) ? unavailable(volume) : null;
    }
    return { ...NO_FOLDER_FINDING, folderMissing: true };
  }

  /**
   * The file side of a kit's finding after a step: only what the renderer
   * can show. A missing file on a drive that isn't connected is counted as
   * the drive (D6), not as missing; one on a drive that didn't respond is
   * not counted at all.
   */
  private findingOf(
    kitName: string,
    rows: KitRowsToCheck,
    drives: ReadonlyMap<string, boolean>,
    slowVolumes: ReadonlySet<string>,
  ): Omit<StoreCheckKitFinding, "notResponding" | keyof FolderFinding> {
    let missing = 0;
    let unreadable = 0;
    const offline = new Map<string, number>();
    for (const { source_path, source_status } of rows.samples) {
      if (source_status === "missing") {
        const volume = volumeOf(source_path);
        // A drive that didn't respond: not known to be missing (it is
        // listed in `notResponding`)
        if (slowVolumes.has(volume)) continue;
        if (drives.get(volume) === false) {
          offline.set(volume, (offline.get(volume) ?? 0) + 1);
        } else {
          missing++;
        }
      } else if (source_status === "unreadable") {
        unreadable++;
      }
    }
    return {
      kitName,
      missing,
      notConnected: [...offline]
        .map(([volume, samples]) => ({ samples, volume }))
        .sort((a, b) => a.volume.localeCompare(b.volume)),
      quarantined: isKitQuarantined(rows.voices, rows.samples),
      unreadable,
    };
  }

  /** The pass ended on its own (a cancelled one has been reset already) */
  private finish(controller: AbortController, completed: boolean): void {
    if (controller.signal.aborted) return;
    this.state = "idle";
    if (completed) {
      this.lastCompletedAt = Date.now();
      // Tells the renderer the pass is over, so it can say once what the
      // pass found (#824)
      this.listener?.({ kits: [], state: this.state });
    } else {
      this.storePath = null;
    }
  }

  /**
   * Whether the drive a missing file was on is connected: a mounted volume
   * that is gone (macOS `/Volumes/<name>` and the like, a Windows drive
   * letter) is a drive that isn't connected (D6). Asked once per drive per
   * pass. A drive that doesn't answer is skipped for the rest of the pass.
   */
  private async noteDrive(
    volume: string,
    drives: Map<string, boolean>,
    limit: <T>(operation: Promise<T>) => Promise<T>,
  ): Promise<void> {
    if (drives.has(volume)) return;
    try {
      await limit(fs.promises.stat(volume));
      drives.set(volume, true);
    } catch (error) {
      if (error instanceof CardNotRespondingError) throw error;
      if (isGone(error)) drives.set(volume, false);
    }
  }

  /**
   * Keep the kit's finding, and tell the renderer if the step changed it,
   * or if its quarantine isn't what the renderer's kit list shows
   */
  private report(
    before: StoreCheckKitFinding,
    after: StoreCheckKitFinding,
    shownQuarantined: boolean,
  ): void {
    if (hasFinding(after)) {
      this.findings.set(after.kitName, after);
    } else {
      this.findings.delete(after.kitName);
    }
    if (!sameFinding(before, after) || shownQuarantined !== after.quarantined) {
      this.listener?.({ kits: [after], state: this.state });
    }
  }

  /** Stop the pass and forget what it found */
  private reset(): void {
    this.controller?.abort();
    this.controller = null;
    this.storePath = null;
    this.findings.clear();
    this.lastCompletedAt = null;
    this.state = "idle";
  }

  private async runPass(
    localStorePath: string,
    controller: AbortController,
    startupQuietMs = storeCheckSettings.startupQuietMs,
  ): Promise<void> {
    const dbDir = ServicePathManager.getDbPath(localStorePath);
    const slow = new Set<string>();
    const drives = new Map<string, boolean>();
    try {
      if (!(await this.waitForQuiet(controller, startupQuietMs, Date.now()))) {
        return;
      }
      const names = getKitNamesForCheck(dbDir);
      if (!names.success || !names.data) {
        // No database to read (it went missing): the next grid load tries
        // again
        this.finish(controller, false);
        return;
      }
      for (const kitName of names.data) {
        const step = [
          localStorePath,
          kitName,
          controller,
          slow,
          drives,
        ] as const;
        const stepped = await this.stepKit(...step); // NOSONAR: one kit per step on purpose
        if (!stepped) return;
      }
      this.finish(controller, true);
    } catch (error) {
      console.warn(
        "[StoreCheck] The pass stopped:",
        error instanceof Error ? error.message : String(error),
      );
      this.finish(controller, false);
    }
  }

  /**
   * Check a kit that a rescan changed, as soon as no write, setup or
   * rescan is in flight; again if one begins meanwhile. A rescan's own call
   * must have ended first (it counts as one), so the first look is a turn
   * of the event loop later. No wait for a quiet moment: the user just
   * asked for this kit.
   */
  private async runRecheck(
    localStorePath: string,
    kitName: string,
    controller: AbortController,
  ): Promise<void> {
    for (;;) {
      await new Promise<void>((resolve) => setImmediate(resolve)); // NOSONAR: yields to the event loop on purpose
      if (controller.signal.aborted) return;
      if (this.activity.exclusiveActive) {
        await sleep(storeCheckSettings.pollMs, controller.signal); // NOSONAR: waits for the exclusive call on purpose
        continue;
      }
      if (await this.checkKit(localStorePath, kitName, controller)) return; // NOSONAR: one kit, again if an exclusive call began
    }
  }

  /**
   * The drives that didn't respond and hold some of this kit's files (or,
   * for a read-only kit, its folder): some of its samples weren't checked
   */
  private slowVolumesOf(
    rows: KitRowsToCheck,
    folderPath: null | string,
    slowVolumes: ReadonlySet<string>,
  ): string[] {
    const volumes = new Set(
      rows.samples.map((row) => volumeOf(row.source_path)),
    );
    if (folderPath !== null) volumes.add(volumeOf(folderPath));
    return [...volumes]
      .filter((volume) => slowVolumes.has(volume))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Wait for a quiet moment, then check one kit; again if a write, setup
   * or rescan began meanwhile. False if the pass was cancelled.
   */
  private async stepKit(
    localStorePath: string,
    kitName: string,
    controller: AbortController,
    slowVolumes: Set<string>,
    drives: Map<string, boolean>,
  ): Promise<boolean> {
    const quietMs = storeCheckSettings.quietMs;
    for (;;) {
      if (!(await this.waitForQuiet(controller, quietMs))) return false; // NOSONAR: waits for a quiet moment on purpose
      if (kitName === this.openKit) return true;
      const args = [
        localStorePath,
        kitName,
        controller,
        slowVolumes,
        drives,
      ] as const;
      if (await this.checkKit(...args)) return true; // NOSONAR: one kit per step on purpose
    }
  }

  /**
   * Yield, then wait until no IPC call has been in flight for `quietMs`.
   * False if the pass was cancelled meanwhile.
   */
  private async waitForQuiet(
    controller: AbortController,
    quietMs: number,
    since = 0,
  ): Promise<boolean> {
    for (;;) {
      await new Promise<void>((resolve) => setImmediate(resolve)); // NOSONAR: yields to the event loop on purpose
      if (controller.signal.aborted) return false;
      if (this.activity.isQuiet(quietMs, since)) {
        this.state = "running";
        return true;
      }
      this.state = this.activity.exclusiveActive ? "paused" : "running";
      await sleep(storeCheckSettings.pollMs, controller.signal);
      if (controller.signal.aborted) return false;
    }
  }
}

/** A kit with nothing found */
function cleanFinding(kitName: string): StoreCheckKitFinding {
  return {
    ...NO_FOLDER_FINDING,
    kitName,
    missing: 0,
    notConnected: [],
    notResponding: [],
    quarantined: false,
    unreadable: 0,
  };
}

function drivesKey({ samples, volume }: { samples: number; volume: string }) {
  return `${volume}\t${samples}`;
}

/** The folder side of a kit's last finding, or nothing found */
function folderPartOf(
  finding: StoreCheckKitFinding | undefined,
): FolderFinding {
  return finding
    ? {
        folderMissing: finding.folderMissing,
        unavailableVolumes: finding.unavailableVolumes,
        untracked: finding.untracked,
      }
    : NO_FOLDER_FINDING;
}

/** Whether the kit has anything to show */
function hasFinding(finding: StoreCheckKitFinding): boolean {
  return (
    finding.missing > 0 ||
    finding.unreadable > 0 ||
    finding.quarantined ||
    finding.folderMissing ||
    finding.untracked.length > 0 ||
    finding.unavailableVolumes.length > 0 ||
    finding.notConnected.length > 0 ||
    finding.notResponding.length > 0
  );
}

/** The fs error says there is no such file or folder (or it isn't one) */
function isGone(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * A voice-prefixed `.wav` file, the way `rescanKit` picks a kit folder's
 * samples: names starting with `.` (macOS `._` AppleDouble files,
 * `.DS_Store`) and other files never count
 */
function isKitWav(name: string): boolean {
  return voiceOfCardFile(name) !== null && name.toLowerCase().endsWith(".wav");
}

function sameFinding(a: StoreCheckKitFinding, b: StoreCheckKitFinding) {
  return (
    a.missing === b.missing &&
    a.unreadable === b.unreadable &&
    a.quarantined === b.quarantined &&
    a.folderMissing === b.folderMissing &&
    a.untracked.join("\n") === b.untracked.join("\n") &&
    a.unavailableVolumes.join("\n") === b.unavailableVolumes.join("\n") &&
    a.notResponding.join("\n") === b.notResponding.join("\n") &&
    a.notConnected.map(drivesKey).join("\n") ===
      b.notConnected.map(drivesKey).join("\n")
  );
}

/** The kit's folder couldn't be checked: its drive isn't connected or didn't respond */
function unavailable(volume: string): FolderFinding {
  return { ...NO_FOLDER_FINDING, unavailableVolumes: [volume] };
}

/** Where each OS mounts a drive: the first group is the volume */
const MOUNT_PATTERNS: readonly RegExp[] = [
  /^(\/Volumes\/[^/]+)(\/|$)/,
  /^(\/media\/[^/]+\/[^/]+)(\/|$)/,
  /^(\/run\/media\/[^/]+\/[^/]+)(\/|$)/,
  /^(\/mnt\/[^/]+)(\/|$)/,
];

/** The shared store check */
export const storeCheckService = new StoreCheckService();

/**
 * The drive a file is on, to skip one that stopped responding: a mounted
 * volume (macOS `/Volumes/<name>`, Linux `/media`, `/run/media` and `/mnt`),
 * else the path's root (a Windows drive letter or share, or `/`)
 */
export function volumeOf(filePath: string): string {
  for (const mount of MOUNT_PATTERNS) {
    const mounted = mount.exec(filePath);
    if (mounted) return mounted[1];
  }
  return path.parse(filePath).root;
}

/** Wait `ms`, or less if `signal` aborts. Never keeps the process alive. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    timer.unref?.();
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

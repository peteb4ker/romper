import type {
  StoreCheckKitFinding,
  StoreCheckStatus,
  StoreCheckUpdate,
} from "@romper/shared/electronApi.js";

import { compareKitSlots } from "@romper/shared/kitUtilsShared.js";
import { isKitQuarantined } from "@romper/shared/stereoLinkRules.js";
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
  /** The same before the first kit of a pass: not while the app is starting */
  startupQuietMs: 2000,
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
   * One step of a pass: check one kit's sample files and record what
   * changed. False if the step must run again (a write, setup or rescan
   * began meanwhile).
   */
  async checkKit(
    dbDir: string,
    kitName: string,
    controller: AbortController = new AbortController(),
    slowVolumes: Set<string> = new Set(),
  ): Promise<boolean> {
    const started = this.activity.exclusiveStartCount;
    const read = withDb(dbDir, (db) => readKitRowsToCheck(db, kitName));
    if (!read.success || !read.data) return true;
    const rows = read.data;
    const before = this.findingOf(kitName, rows);

    const limit = <T>(operation: Promise<T>) =>
      withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);
    const found: SampleCheck[] = [];
    for (const sample of rows.samples) {
      if (controller.signal.aborted) return true;
      const volume = volumeOf(sample.source_path);
      if (slowVolumes.has(volume)) continue;
      try {
        // One operation at a time: never Promise.all
        found.push(await checkSampleFile(sample, limit)); // NOSONAR: one fs operation at a time on purpose
      } catch (error) {
        if (error instanceof CardNotRespondingError) slowVolumes.add(volume);
      }
    }
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
    let after = before;
    if (changes.length > 0) {
      // The rows are read again in the transaction, so the finding is what
      // the store holds after the record
      const saved = withDbTransaction(dbDir, (db) => {
        for (const { fields, sample } of changes) {
          updateSampleSourceStatusTx(db, sample.id, fields, sample.source_path);
        }
        return this.findingOf(kitName, readKitRowsToCheck(db, kitName));
      });
      if (saved.success && saved.data) after = saved.data;
    }
    this.report(before, after);
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

  /** The kit's finding after a step: only what the renderer can show */
  private findingOf(kitName: string, rows: KitRowsToCheck) {
    let missing = 0;
    let unreadable = 0;
    for (const { source_status } of rows.samples) {
      if (source_status === "missing") missing++;
      else if (source_status === "unreadable") unreadable++;
    }
    return {
      kitName,
      missing,
      quarantined: isKitQuarantined(rows.voices, rows.samples),
      unreadable,
    };
  }

  /** The pass ended on its own (a cancelled one has been reset already) */
  private finish(controller: AbortController, completed: boolean): void {
    if (controller.signal.aborted) return;
    this.state = "idle";
    if (completed) this.lastCompletedAt = Date.now();
    else this.storePath = null;
  }

  /** Keep the kit's finding, and tell the renderer if the step changed it */
  private report(
    before: StoreCheckKitFinding,
    after: StoreCheckKitFinding,
  ): void {
    if (after.missing > 0 || after.unreadable > 0 || after.quarantined) {
      this.findings.set(after.kitName, after);
    } else {
      this.findings.delete(after.kitName);
    }
    const changed =
      before.missing !== after.missing ||
      before.unreadable !== after.unreadable ||
      before.quarantined !== after.quarantined;
    if (changed) this.listener?.({ kits: [after], state: this.state });
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
  ): Promise<void> {
    const dbDir = ServicePathManager.getDbPath(localStorePath);
    const slowVolumes = new Set<string>();
    try {
      if (
        !(await this.waitForQuiet(
          controller,
          storeCheckSettings.startupQuietMs,
          Date.now(),
        ))
      ) {
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
        let checked = false;
        while (!checked) {
          if (
            !(await this.waitForQuiet(controller, storeCheckSettings.quietMs))
          ) {
            return;
          }
          if (kitName === this.openKit) break;
          checked = await this.checkKit(
            dbDir,
            kitName,
            controller,
            slowVolumes,
          );
        }
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

/** The shared store check */
export const storeCheckService = new StoreCheckService();

/**
 * The drive a file is on, to skip one that stopped responding: a mounted
 * volume (macOS `/Volumes/<name>`, Linux `/media`, `/run/media` and `/mnt`),
 * else the path's root (a Windows drive letter or share, or `/`)
 */
export function volumeOf(filePath: string): string {
  const mounted =
    /^(\/Volumes\/[^/]+|\/media\/[^/]+\/[^/]+|\/run\/media\/[^/]+\/[^/]+|\/mnt\/[^/]+)(\/|$)/.exec(
      filePath,
    );
  return mounted?.[1] ?? path.parse(filePath).root;
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

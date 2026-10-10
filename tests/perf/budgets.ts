/**
 * Performance budgets, pinned in code (docs/developer/coding-guide.md,
 * "Performance budgets").
 *
 * Each budget caps one deterministic count for one action or operation:
 * IPC calls per user action (e2e), database connections, SQL statements and
 * synchronous fs calls per main-process operation (integration). Wall-clock
 * timings aren't budgeted on PRs: shared CI runners make them flaky. The
 * validation profile adds headroom budgets for bytes and main-thread stalls,
 * which only run in the manual validation workflow.
 *
 * Budgets ratchet:
 * - `max` is today's measured value, so a change that makes a count worse
 *   fails as a regression.
 * - `target` and `until` record what a planned refactor
 *   (docs/developer/architecture-review.md) will bring the count down to.
 *   Once the count is at or below `target`, the check fails as stale: set
 *   `max` to the new count and remove `target`/`until` in the same PR.
 * - A metric that's measured but has no budget fails too, so a new IPC
 *   channel showing up in an action gets noticed. `total` is the one metric
 *   that may be measured without a budget.
 *
 * The numbers live here and nowhere else. Don't copy them into Markdown.
 */
import fs from "node:fs";
import path from "node:path";

export interface Budget {
  max: number;
  target?: number;
  /**
   * The issue tracking the refactor (`#452`). Older budgets name a finding
   * from the frozen findings register (`RE-36`).
   */
  until?: `#${number}` | `RE-${number}`;
}

/** Budgets for one action or operation, by metric */
export type Budgets = Record<string, Budget>;

/** The metric every action may report without budgeting it */
export const TOTAL = "total";

/**
 * RE-81: each store's connection is opened once and kept, so an operation
 * on an open store opens none
 */
const NO_NEW_CONNECTION = { max: 0 } as const;
/**
 * #452: an edit in the kit editor reloads only its kit (`get-kit`), never
 * every kit
 */
const NO_RELOAD = { max: 0 } as const;
/**
 * #452: the voice panels and a drop's duplicate check read the kit's rows
 * as loaded, so nothing asks main for a kit's samples again
 */
const NO_SAMPLES_FETCH = { max: 0 } as const;
/** #452: an edit returns the kit it changed, so nothing reads it again */
const NO_KIT_READ = { max: 0 } as const;

const kb = (n: number) => Math.round(n * 1024);
const mb = (n: number) => Math.round(n * 1024 * 1024);
/**
 * Validation headroom: the factory-scale profile runs on three OSes and
 * shared runners, so these are well above what it measures, and catch
 * a step change rather than drift.
 */
const STALL = { max: 250 } as const;
const SMALL = { max: kb(4) } as const;

export const BUDGETS = {
  /**
   * IPC calls per user action, by channel, on the standard e2e fixture
   * (tests/e2e/performance-budgets.e2e.test.ts). Channels whose call count
   * depends on timing are left out (UNCOUNTED_CHANNELS in
   * tests/utils/e2e-ipc-budget.ts).
   */
  e2e: {
    "cold start to the kit grid": {
      /** RE-90: bank names come from the banks, not the kits */
      "get-all-banks": { max: 1 },
      "get-all-kits": { max: 1 },
      "get-local-store-status": { max: 1 },
      /** #812: the grid asks once; the check's own work isn't IPC */
      "get-store-check-status": { max: 1 },
      "read-settings": { max: 2 },
    },
    /**
     * #452: a new kit main returns goes on the list, and a deleted one comes
     * off it, without reading every kit
     */
    "create a kit": {
      "create-kit": { max: 1 },
      "get-all-kits": NO_RELOAD,
      total: { max: 1 },
    },
    "delete a kit": {
      "delete-kit": { max: 1 },
      "get-all-kits": NO_RELOAD,
      "get-kit-delete-summary": { max: 1 },
      total: { max: 2 },
    },
    /**
     * #452: the delete returns the kit it changed and the voice as it was,
     * for undo, so nothing reads either
     */
    "delete a sample": {
      "delete-sample-from-slot": { max: 1 },
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-kit": NO_KIT_READ,
    },
    "drop a sample": {
      "add-sample-to-slot": { max: 1 },
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      /** #452: the add returns the kit it changed, so nothing reads it */
      "get-kit": NO_KIT_READ,
      "get-sample-audio-buffer": { max: 1 },
      "register-dropped-file": { max: 1 },
      total: { max: 4 },
      "validate-sample-format": { max: 1 },
    },
    "duplicate a kit": {
      "copy-kit": { max: 1 },
      "get-all-kits": NO_RELOAD,
      total: { max: 1 },
    },
    "enable editing": {
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "update-kit-metadata": { max: 1 },
    },
    /** RE-88: a burst of wheel notches is saved once, after the last */
    "gain: 5 wheel steps": {
      "update-sample-gain": { max: 1 },
    },
    /**
     * B1 has two filled slots, each fetched once: the editor no longer
     * renders B1 with the last kit's samples first (#697). Its files are
     * checked as it opens, the first time with a reload (see "open a
     * kit").
     */
    "next kit": {
      "check-kit-sample-files": { max: 1 },
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-kit": { max: 1 },
      "get-sample-audio-buffer": { max: 2 },
    },
    /**
     * #537: every open checks the kit's files in one batch
     * (`check-kit-sample-files`: a stat per file, and a header read only
     * for files not known to be readable). The fixture's samples have
     * never been checked (an older library), so the first open records
     * their status and reloads the kit once (`get-kit`). When nothing
     * changed, an open costs the check and no reload. The kit's sample
     * details come with the kit, so an open doesn't fetch them (#452).
     */
    "open a kit": {
      "check-kit-sample-files": { max: 1 },
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-kit": { max: 1 },
      "get-sample-audio-buffer": { max: 2 },
    },
    "open the write summary": {
      generateSyncChangeSummary: { max: 1 },
    },
    /**
     * Back to A0, whose audio the renderer kept from "open a kit" (#478).
     * Each filled slot still asks main, which checks the file is unchanged
     * and sends back only its version, not the file. A version holds the
     * file's path, whose length differs by OS and temp folder, so the bytes
     * budget has headroom; one of the fixture's files is several times it.
     */
    "previous kit": {
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-sample-audio-buffer": { max: 2 },
      "get-sample-audio-buffer bytes": { max: kb(2) },
    },
    /** #452: the rename returns the kit it changed, so nothing reads it */
    "rename a voice": {
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-kit": NO_KIT_READ,
      "update-voice-alias": { max: 1 },
    },
    /**
     * #452: the save returns the kit it changed, without its samples, and
     * nothing reads the kit again: one call. What it returns holds no file
     * paths, so its size doesn't depend on the OS.
     */
    "toggle a sequencer step": {
      "get-all-kits": NO_RELOAD,
      "get-all-samples-for-kit": NO_SAMPLES_FETCH,
      "get-kit": NO_KIT_READ,
      total: { max: 1 },
      "update-step-pattern": { max: 1 },
      "update-step-pattern bytes": { max: kb(4) },
    },
  },

  /**
   * Main-process operations through their IPC handlers, on the generated
   * store in tests/integration/performance-budgets.integration.test.ts.
   * `connections`: better-sqlite3 connections opened. `statements`:
   * statements prepared plus `exec` and `pragma` calls. `syncFsCalls`:
   * existsSync, statSync, readSync, readdirSync and readFileSync calls, the
   * proxy for time the operation holds the main thread.
   */
  integration: {
    /**
     * #452: sample edits read the kit back (4 statements) and return it,
     * and delete and move read the kit's rows first for undo (1). That
     * replaces the renderer's own `get-kit` and `get-all-samples-for-kit`
     * calls, which ran the same statements plus an IPC round trip each.
     */
    "add sample": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 7 },
    },
    "delete sample": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 12 },
    },
    "get kits": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 4 },
    },
    /**
     * #478 (RE-83): one slot's row, not the whole kit's, and the file read
     * without holding the main thread
     */
    "load a slot's audio": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 1 },
      syncFsCalls: { max: 0 },
    },
    "move sample between kits": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 11 },
    },
    "move sample within a kit": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 23 },
    },
    "plan a sync (write summary)": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 4 },
      /** Planning's own file reads are asynchronous (RE-82). */
      syncFsCalls: { max: 0 },
    },
    /** The generated store's six kits, each as above, and the kit list */
    "store check: full pass": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 73 },
      syncFsCalls: { max: 0 },
    },
    /**
     * #650: a full write of the mixed-format store in
     * tests/integration/sync-write-budget.integration.test.ts.
     * `cardWrites`: files written to the card, one per sample on an empty
     * card. `syncFsCalls` as above, for the whole write: conversions read
     * their headers asynchronously too (RE-07).
     */
    /**
     * #812: the background check of the store's sample files. A step is one
     * kit: its rows are read, and what changed is recorded in one
     * transaction, which reads them again. Measured on a kit whose files
     * were never checked (an older library), so each of its eight rows is
     * updated; later passes record nothing. It makes no sync fs call and
     * opens no connection.
     */
    "store check: one kit": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 12 },
      syncFsCalls: { max: 0 },
    },
    "write a full card": {
      cardWrites: { max: 77 },
      syncFsCalls: { max: 0 },
    },
    /**
     * #650: the same store written again, unchanged. A file the card
     * already holds byte for byte isn't written again.
     */
    "write an unchanged card again": {
      cardWrites: { max: 0 },
      syncFsCalls: { max: 0 },
    },
  },

  /**
   * Headroom budgets for the factory-scale profile
   * (tests/validation/performance.validation.ts), which only runs in the
   * manual validation workflow. `bytes` is the size of everything IPC
   * returned; `mainBusyMs` is the longest main-thread stall, counting only
   * the time main was running. Time the OS kept an idle main thread waiting
   * for a core isn't counted: on a loaded runner that alone reached 384 ms
   * with no IPC call (#675).
   */
  validation: {
    "back to the grid": { bytes: SMALL, mainBusyMs: STALL },
    "cold start": { bytes: { max: mb(2) } },
    /** #452: edits reload one kit, so the library isn't sent each time */
    "delete a sample": { bytes: { max: kb(512) }, mainBusyMs: STALL },
    "drop a sample on voice 4": {
      bytes: { max: kb(128) },
      mainBusyMs: STALL,
    },
    /** #452: the kit's details come with it, so editing fetches none */
    "enable editing": { bytes: SMALL, mainBusyMs: STALL },
    "gain: 10 wheel steps on one knob": {
      bytes: SMALL,
      mainBusyMs: STALL,
    },
    "idle on the kit grid, 10 s": { bytes: SMALL, mainBusyMs: STALL },
    "next kit (A1)": { bytes: { max: mb(22) }, mainBusyMs: STALL },
    "open kit A0": { bytes: { max: mb(6) }, mainBusyMs: STALL },
    "open the sequencer": { bytes: SMALL, mainBusyMs: STALL },
    /** Planning yields instead of holding main for the whole plan (RE-82) */
    "open the write summary": { bytes: { max: kb(8) }, mainBusyMs: STALL },
    /**
     * RE-83: a revisited kit's buffers come from the renderer's cache, so
     * main sends each slot's file version, not the file (#478)
     */
    "previous kit (A0)": { bytes: { max: kb(64) }, mainBusyMs: STALL },
    /** #452: the rename returns the kit, without its samples */
    "rename voice 1": { bytes: { max: kb(8) }, mainBusyMs: STALL },
    "search: clear": { bytes: SMALL, mainBusyMs: STALL },
    "search: type 'kick'": { bytes: SMALL, mainBusyMs: STALL },
    "sequencer playing, 5 s": { bytes: SMALL, mainBusyMs: STALL },
    /**
     * #812: the background check of every kit's sample files, one kit per
     * step; its polling for the end of the pass is the only IPC it makes
     */
    "store check: full pass": { bytes: SMALL, mainBusyMs: STALL },
    /**
     * #452: each save returns the kit it changed, without its samples (its
     * pattern, conditions, slices and voices), and nothing reads it again
     */
    "toggle 4 sequencer steps": {
      bytes: { max: kb(32) },
      mainBusyMs: STALL,
    },
    "toggle a favourite": { bytes: SMALL, mainBusyMs: STALL },
  },
} satisfies Record<string, Record<string, Budgets>>;

/**
 * Plain-language names for the e2e actions, for readers who aren't
 * engineers (the public "How Romper is tested" page reads them from the
 * report). Every e2e action needs one.
 */
export const E2E_LABELS: Record<keyof typeof BUDGETS.e2e, string> = {
  "cold start to the kit grid": "Opening the app",
  "create a kit": "Creating a kit",
  "delete a kit": "Deleting a kit",
  "delete a sample": "Deleting a sample",
  "drop a sample": "Adding a sample",
  "duplicate a kit": "Duplicating a kit",
  "enable editing": "Turning on editing",
  "gain: 5 wheel steps": "Changing a sample's volume",
  "next kit": "Moving to the next kit",
  "open a kit": "Opening a kit",
  "open the write summary": "Preparing a card write",
  "previous kit": "Going back to a kit you just left",
  "rename a voice": "Renaming a voice",
  "toggle a sequencer step": "Editing a pattern step",
};

/** "<suite>/<action>": a typo is a compile error */
export type BudgetName = {
  [S in Suite]: `${S}/${Extract<keyof (typeof BUDGETS)[S], string>}`;
}[Suite];

/** One row of the machine-readable budget report (JSON lines) */
export interface BudgetReportRow {
  /** Plain-language action name (e2e only; null elsewhere) */
  label: null | string;
  max: null | number;
  measured: number;
  metric: string;
  name: string;
  suite: string;
  target: null | number;
  until: null | string;
}

export type Suite = keyof typeof BUDGETS;

/** The report rows for an action: one per budgeted or measured metric */
export function budgetReportRows(
  name: BudgetName,
  measured: Record<string, number>,
): BudgetReportRow[] {
  const { action, suite } = split(name);
  const budgets = (BUDGETS[suite] as Record<string, Budgets>)[action] ?? {};
  const label =
    suite === "e2e"
      ? (E2E_LABELS[action as keyof typeof E2E_LABELS] ?? null)
      : null;
  return metricsOf(budgets, measured).map((metric) => ({
    label,
    max: budgets[metric]?.max ?? null,
    measured: measured[metric] ?? 0,
    metric,
    name: action,
    suite,
    target: budgets[metric]?.target ?? null,
    until: budgets[metric]?.until ?? null,
  }));
}

/**
 * Check an action's measured values against its budgets in BUDGETS.
 * Metrics with a budget but no measurement count as 0.
 */
export function checkBudgets(
  name: BudgetName,
  measured: Record<string, number>,
): string[] {
  const { action, suite } = split(name);
  const budgets = (BUDGETS[suite] as Record<string, Budgets>)[action];
  if (!budgets) return [`${name}: no budgets for this action`];
  return compareBudgets(budgets, measured).map((f) => `${name}: ${f}`);
}

/**
 * Compare measured values with a set of budgets. Returns one failure string
 * per problem; an empty array means every budget holds.
 */
export function compareBudgets(
  budgets: Budgets,
  measured: Record<string, number>,
): string[] {
  const failures: string[] = [];
  for (const metric of metricsOf(budgets, measured)) {
    const budget = budgets[metric];
    const value = measured[metric] ?? 0;
    if (!budget) {
      if (metric !== TOTAL) {
        failures.push(
          `${metric}: measured ${value} but has no budget; add one (max: ${value})`,
        );
      }
      continue;
    }
    if (value > budget.max) {
      failures.push(
        `${metric}: regression: measured ${value}, budget ${budget.max}`,
      );
    } else if (budget.target !== undefined && value <= budget.target) {
      failures.push(
        `${metric}: ${budget.until ?? "the refactor"} reached its target: set max to ${value} and remove target/until`,
      );
    }
  }
  return failures;
}

/** Record the action in the report, then check it */
export function enforceBudgets(
  name: BudgetName,
  measured: Record<string, number>,
): string[] {
  reportBudgets(name, measured);
  return checkBudgets(name, measured);
}

/**
 * Append the action's rows to the file named by ROMPER_BUDGET_REPORT, as
 * JSON lines, creating its folder if needed. Does nothing when it isn't set.
 */
export function reportBudgets(
  name: BudgetName,
  measured: Record<string, number>,
): void {
  const file = process.env.ROMPER_BUDGET_REPORT;
  if (!file) return;
  const lines = budgetReportRows(name, measured).map((row) =>
    JSON.stringify(row),
  );
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, lines.map((line) => `${line}\n`).join(""));
}

function metricsOf(budgets: Budgets, measured: Record<string, number>) {
  return [...new Set([...Object.keys(budgets), ...Object.keys(measured)])].sort(
    (a, b) => a.localeCompare(b),
  );
}

function split(name: string): { action: string; suite: Suite } {
  const slash = name.indexOf("/");
  return {
    action: name.slice(slash + 1),
    suite: name.slice(0, slash) as Suite,
  };
}

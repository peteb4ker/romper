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
  until?: `RE-${number}`;
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
/** RE-36: edits return the changed kit instead of reloading every kit */
const NO_RELOAD = { target: 0, until: "RE-36" } as const;

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
      "read-settings": { max: 2 },
      "scan-banks": { max: 1 },
    },
    "delete a sample": {
      "delete-sample-from-slot": { max: 1 },
      "get-all-kits": { max: 1, ...NO_RELOAD },
      "get-all-samples-for-kit": { max: 3 },
    },
    "drop a sample": {
      "add-sample-to-slot": { max: 1 },
      "get-all-kits": { max: 2, ...NO_RELOAD },
      "get-all-samples-for-kit": { max: 4 },
      "get-sample-audio-buffer": { max: 1 },
      "register-dropped-file": { max: 1 },
      total: { max: 10, target: 5, until: "RE-36" },
      "validate-sample-format": { max: 1 },
    },
    "enable editing": {
      "get-all-samples-for-kit": { max: 1 },
      "update-kit-metadata": { max: 1 },
    },
    "gain: 5 wheel steps": {
      "update-sample-gain": { max: 5 },
    },
    /** B1 has two filled slots; RE-83 fetches each once */
    "next kit": {
      "get-all-samples-for-kit": { max: 1 },
      "get-sample-audio-buffer": { max: 4, target: 2, until: "RE-83" },
    },
    "open a kit": {
      "get-all-samples-for-kit": { max: 1 },
      "get-sample-audio-buffer": { max: 2 },
    },
    "open the write summary": {
      generateSyncChangeSummary: { max: 1 },
    },
    "rename a voice": {
      "get-all-kits": { max: 1, ...NO_RELOAD },
      "get-all-samples-for-kit": { max: 1 },
      "update-voice-alias": { max: 1 },
    },
    "toggle a sequencer step": {
      "get-all-kits": { max: 1, ...NO_RELOAD },
      "get-all-samples-for-kit": { max: 1 },
      total: { max: 3, target: 1, until: "RE-36" },
      "update-step-pattern": { max: 1 },
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
    "add sample": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 2 },
    },
    "delete sample": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 6 },
    },
    "get kits": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 4 },
    },
    "move sample between kits": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 10 },
    },
    "move sample within a kit": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 17 },
    },
    "plan a sync (write summary)": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 39 },
      syncFsCalls: { max: 498, target: 0, until: "RE-82" },
    },
    "replace sample": {
      connections: NO_NEW_CONNECTION,
      statements: { max: 4 },
    },
  },

  /**
   * Headroom budgets for the factory-scale profile
   * (tests/validation/performance.validation.ts), which only runs in the
   * manual validation workflow. `bytes` is the size of everything IPC
   * returned; `mainBlockedMs` is the longest main-thread stall.
   */
  validation: {
    "back to the grid": { bytes: SMALL, mainBlockedMs: STALL },
    "cold start": { bytes: { max: mb(2) } },
    "delete a sample": { bytes: { max: mb(2.6) }, mainBlockedMs: STALL },
    "drop a sample on voice 4": {
      bytes: { max: mb(4) },
      mainBlockedMs: STALL,
    },
    "enable editing": { bytes: { max: kb(24) }, mainBlockedMs: STALL },
    "gain: 10 wheel steps on one knob": {
      bytes: SMALL,
      mainBlockedMs: STALL,
    },
    "idle on the kit grid, 10 s": { bytes: SMALL, mainBlockedMs: STALL },
    "next kit (A1)": { bytes: { max: mb(22) }, mainBlockedMs: STALL },
    "open kit A0": { bytes: { max: mb(6) }, mainBlockedMs: STALL },
    "open the sequencer": { bytes: SMALL, mainBlockedMs: STALL },
    /** RE-82: planning yields instead of holding main for the whole plan */
    "open the write summary": {
      bytes: { max: kb(8) },
      mainBlockedMs: { max: 2000, target: 50, until: "RE-82" },
    },
    /** RE-83: a revisited kit's buffers come from the renderer's cache */
    "previous kit (A0)": {
      bytes: { max: mb(12), target: kb(64), until: "RE-83" },
      mainBlockedMs: STALL,
    },
    "rename voice 1": { bytes: { max: mb(2) }, mainBlockedMs: STALL },
    "search: clear": { bytes: SMALL, mainBlockedMs: STALL },
    "search: type 'kick'": { bytes: SMALL, mainBlockedMs: STALL },
    "sequencer playing, 5 s": { bytes: SMALL, mainBlockedMs: STALL },
    "toggle 4 sequencer steps": {
      bytes: { max: mb(8), target: kb(4), until: "RE-36" },
      mainBlockedMs: STALL,
    },
    "toggle a favourite": { bytes: SMALL, mainBlockedMs: STALL },
  },
} satisfies Record<string, Record<string, Budgets>>;

/**
 * Plain-language names for the e2e actions, for readers who aren't
 * engineers (the public "How Romper is tested" page reads them from the
 * report). Every e2e action needs one.
 */
export const E2E_LABELS: Record<keyof typeof BUDGETS.e2e, string> = {
  "cold start to the kit grid": "Opening the app",
  "delete a sample": "Deleting a sample",
  "drop a sample": "Adding a sample",
  "enable editing": "Turning on editing",
  "gain: 5 wheel steps": "Changing a sample's volume",
  "next kit": "Moving to the next kit",
  "open a kit": "Opening a kit",
  "open the write summary": "Preparing a card write",
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

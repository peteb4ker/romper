import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  budgetReportRows,
  type Budgets,
  BUDGETS,
  checkBudgets,
  compareBudgets,
  reportBudgets,
} from "../perf/budgets";

describe("performance budgets", () => {
  describe("compareBudgets", () => {
    const budgets: Budgets = {
      "get-all-kits": { max: 2, target: 0, until: "RE-36" },
      "update-step-pattern": { max: 1 },
    };

    it("passes at or under max", () => {
      expect(
        compareBudgets(budgets, {
          "get-all-kits": 2,
          "update-step-pattern": 1,
        }),
      ).toEqual([]);
      expect(
        compareBudgets(budgets, {
          "get-all-kits": 1,
          "update-step-pattern": 0,
        }),
      ).toEqual([]);
    });

    it("fails over max as a regression", () => {
      expect(
        compareBudgets(budgets, {
          "get-all-kits": 3,
          "update-step-pattern": 1,
        }),
      ).toEqual(["get-all-kits: regression: measured 3, budget 2"]);
    });

    it("fails at or below target as stale, naming the refactor", () => {
      expect(compareBudgets(budgets, { "update-step-pattern": 1 })).toEqual([
        "get-all-kits: RE-36 reached its target: set max to 0 and remove target/until",
      ]);
    });

    it("fails a measured metric that has no budget", () => {
      expect(
        compareBudgets(budgets, {
          "get-all-kits": 1,
          "read-file": 2,
          "update-step-pattern": 1,
        }),
      ).toEqual(["read-file: measured 2 but has no budget; add one (max: 2)"]);
    });

    it("lets total go unbudgeted, but checks it when budgeted", () => {
      expect(compareBudgets(budgets, { "get-all-kits": 1, total: 9 })).toEqual(
        [],
      );
      expect(compareBudgets({ total: { max: 4 } }, { total: 5 })).toEqual([
        "total: regression: measured 5, budget 4",
      ]);
    });
  });

  describe("checkBudgets", () => {
    it("checks against the named action's budgets", () => {
      expect(
        checkBudgets("e2e/gain: 5 wheel steps", {
          total: 5,
          "update-sample-gain": 5,
        }),
      ).toEqual([]);
      expect(
        checkBudgets("e2e/gain: 5 wheel steps", { "update-sample-gain": 6 }),
      ).toEqual([
        "e2e/gain: 5 wheel steps: update-sample-gain: regression: measured 6, budget 5",
      ]);
    });

    it("fails an action that has no budgets", () => {
      expect(
        checkBudgets("e2e/no such action" as "e2e/next kit", { total: 1 }),
      ).toEqual(["e2e/no such action: no budgets for this action"]);
    });
  });

  describe("the budgets themselves", () => {
    const all = Object.entries(BUDGETS).flatMap(([suite, actions]) =>
      Object.entries(actions as Record<string, Budgets>).flatMap(
        ([action, budgets]) =>
          Object.entries(budgets).map(([metric, budget]) => ({
            budget,
            name: `${suite}/${action}: ${metric}`,
          })),
      ),
    );

    it("pair every target with the finding that reaches it, below max", () => {
      for (const { budget, name } of all) {
        expect(budget.max, name).toBeGreaterThanOrEqual(0);
        expect(budget.target === undefined, name).toBe(
          budget.until === undefined,
        );
        if (budget.target !== undefined) {
          expect(budget.target, name).toBeLessThan(budget.max);
        }
      }
    });
  });

  describe("report", () => {
    let dir: string | undefined;

    afterEach(() => {
      vi.unstubAllEnvs();
      if (dir) fs.rmSync(dir, { force: true, recursive: true });
    });

    it("has one row per budgeted or measured metric", () => {
      expect(
        budgetReportRows("e2e/next kit", {
          "get-sample-audio-buffer": 4,
          total: 5,
        }),
      ).toEqual([
        {
          label: "Moving to the next kit",
          max: 1,
          measured: 0,
          metric: "check-kit-sample-files",
          name: "next kit",
          suite: "e2e",
          target: null,
          until: null,
        },
        {
          label: "Moving to the next kit",
          max: 1,
          measured: 0,
          metric: "get-all-kits",
          name: "next kit",
          suite: "e2e",
          target: 0,
          until: "RE-36",
        },
        {
          label: "Moving to the next kit",
          max: 2,
          measured: 0,
          metric: "get-all-samples-for-kit",
          name: "next kit",
          suite: "e2e",
          target: null,
          until: null,
        },
        {
          label: "Moving to the next kit",
          max: 2,
          measured: 4,
          metric: "get-sample-audio-buffer",
          name: "next kit",
          suite: "e2e",
          target: null,
          until: null,
        },
        {
          label: "Moving to the next kit",
          max: null,
          measured: 5,
          metric: "total",
          name: "next kit",
          suite: "e2e",
          target: null,
          until: null,
        },
      ]);
    });

    it("labels only e2e rows", () => {
      expect(
        budgetReportRows("integration/get kits", { connections: 1 })[0].label,
      ).toBeNull();
    });

    it("appends JSON lines to ROMPER_BUDGET_REPORT, creating its folder", () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-budget-report-"));
      const file = path.join(dir, "reports", "budgets-e2e.jsonl");
      vi.stubEnv("ROMPER_BUDGET_REPORT", file);

      reportBudgets("e2e/gain: 5 wheel steps", { "update-sample-gain": 5 });
      reportBudgets("e2e/open the write summary", {
        generateSyncChangeSummary: 1,
      });

      const rows = fs
        .readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(rows.map((r) => `${r.label}: ${r.metric}=${r.measured}`)).toEqual([
        "Changing a sample's volume: update-sample-gain=5",
        "Preparing a card write: generateSyncChangeSummary=1",
      ]);
      expect(Object.keys(rows[0]).sort()).toEqual([
        "label",
        "max",
        "measured",
        "metric",
        "name",
        "suite",
        "target",
        "until",
      ]);
    });

    it("writes nothing when ROMPER_BUDGET_REPORT isn't set", () => {
      vi.stubEnv("ROMPER_BUDGET_REPORT", "");
      const append = vi.spyOn(fs, "appendFileSync");
      reportBudgets("e2e/gain: 5 wheel steps", { "update-sample-gain": 5 });
      expect(append).not.toHaveBeenCalled();
      append.mockRestore();
    });
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  platformOf,
  summarise,
  summariseBudgets,
} from "../testing-summary.mjs";

const vitest = (total: number, passed: number) =>
  JSON.stringify({ numPassedTests: passed, numTotalTests: total });
const playwright = (expected: number, unexpected = 0, flaky = 0) =>
  JSON.stringify({ stats: { expected, flaky, skipped: 2, unexpected } });
const rehearsal = (statuses: string[]) =>
  JSON.stringify({
    checks: statuses.map((status, i) => ({ name: `c${i}`, status })),
    facts: {
      "card files converted": 4,
      "card files copied": 10,
      "kits imported": 183,
      "samples imported": 2366,
    },
  });
const budget = (row: object) => JSON.stringify({ suite: "e2e", ...row });

describe("platformOf", () => {
  it("reads the platform from the artifact folder", () => {
    expect(platformOf("validation-report-macos-latest/x/report.json")).toBe(
      "macOS",
    );
    expect(platformOf("test-results-unit/results-unit.json")).toBeUndefined();
  });
});

describe("summarise", () => {
  const useCases = [
    { status: "supported" },
    { status: "supported" },
    { status: "partial" },
    { status: "not built" },
  ];

  it("counts each layer once and lists the platforms where it all passed", () => {
    const summary = summarise({
      commit: "abc",
      date: "2026-10-03",
      files: [
        {
          content: vitest(3800, 3800),
          path: "test-results-unit/results-unit.json",
        },
        {
          content: vitest(560, 560),
          path: "test-results-integration-ubuntu-latest/results-integration.json",
        },
        {
          content: vitest(560, 559),
          path: "test-results-integration-windows-latest/results-integration.json",
        },
        {
          content: playwright(60, 0, 2),
          path: "e2e-ubuntu-latest/results-e2e.json",
        },
        {
          content: rehearsal(["pass", "pass", "known"]),
          path: "validation-report-macos-latest/validation-report/report.json",
        },
        {
          content: "{}",
          path: "validation-report-macos-latest/validation-report/performance/report.json",
        },
      ],
      useCases,
      version: "v1.3.2",
    });

    expect(summary.layers.unit).toEqual({
      passed: 3800,
      platforms: [],
      tests: 3800,
    });
    // Windows had a failure, so only Linux is listed
    expect(summary.layers.integration.platforms).toEqual(["Linux"]);
    expect(summary.layers.e2e).toEqual({
      passed: 62,
      platforms: ["Linux"],
      tests: 62,
    });
    expect(summary.layers.rehearsal).toMatchObject({
      cardFiles: 14,
      kits: 183,
      knownIssues: 1,
      passed: 2,
      platforms: ["macOS"],
      samples: 2366,
      tests: 2,
    });
    expect(summary.useCases).toEqual({
      notBuilt: 1,
      partial: 1,
      supported: 2,
      total: 4,
    });
    expect(summary.version).toBe("v1.3.2");
  });
});

describe("summariseBudgets", () => {
  it("gives each user action one status, the worst of its metrics", () => {
    const rows = [
      budget({
        label: "Opening a kit",
        max: 4,
        measured: 4,
        metric: "total",
        name: "open a kit",
      }),
      budget({
        max: 1,
        measured: 1,
        metric: "get-all-kits",
        name: "toggle a step",
        target: 0,
        until: "RE-36",
      }),
      budget({ max: 3, measured: 2, metric: "total", name: "toggle a step" }),
      JSON.stringify({
        max: 5,
        measured: 5,
        metric: "x",
        name: "db op",
        suite: "integration",
      }),
    ].map((r) => JSON.parse(r));

    expect(summariseBudgets(rows)).toEqual([
      { action: "Opening a kit", status: "within" },
      { action: "Toggle a step", status: "improving" },
    ]);
  });
});

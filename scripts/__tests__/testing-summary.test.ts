// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EntrySummary, Status } from "../traceability.mjs";

import {
  countStatuses,
  findReports,
  groupEntries,
  isRehearsalReport,
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
// The reports every summary needs, for tests about one of them
const base = [
  { content: vitest(10, 10), path: "test-results-unit/results-unit.json" },
  {
    content: vitest(5, 5),
    path: "test-results-integration-ubuntu-latest/results-integration.json",
  },
  {
    content: playwright(3),
    path: "test-results-e2e-ubuntu-latest-shard-1-of-1/results-e2e.json",
  },
  {
    content: rehearsal(["pass"]),
    path: "validation-report-ubuntu-latest/validation-report/report.json",
  },
  {
    content: budget({ max: 1, measured: 1, metric: "x", name: "open a kit" }),
    path: "test-results-e2e-ubuntu-latest-shard-1-of-1/budgets-e2e.jsonl",
  },
];
const without = (name: string) =>
  base.filter((f) => path.basename(f.path) !== name);

describe("platformOf", () => {
  it("reads the platform from the artifact folder", () => {
    expect(platformOf("validation-report-macos-latest/x/report.json")).toBe(
      "macOS",
    );
    expect(platformOf("test-results-unit/results-unit.json")).toBeUndefined();
  });
});

describe("summarise", () => {
  // Statuses as traceability.mjs generates them from the open issues
  const entry = (
    id: string,
    kind: EntrySummary["kind"],
    status: Status,
  ): EntrySummary => ({
    gap: null,
    group: kind === "quality" ? "Qualities" : "Samples",
    id,
    kind,
    name: id,
    openIssues: status === "partial" ? 1 : 0,
    status,
    tests: { e2e: 0, integration: 0, unit: 0, validation: 0 },
  });
  const entries = [
    entry("UC-19", "use case", "supported"),
    entry("UC-20", "use case", "not built"),
    entry("UC-23", "use case", "supported"),
    entry("UC-24", "use case", "partial"),
    entry("Q-01", "quality", "partial"),
  ];

  it("counts each layer once and lists the platforms where it all passed", () => {
    const summary = summarise({
      commit: "abc",
      date: "2026-10-03",
      entries,
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
        base[4],
      ],
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
    // The page's chips show the generated status
    expect(
      summary.groups.flatMap((g) => g.entries.map((e) => [e.id, e.status])),
    ).toEqual([
      ["UC-19", "supported"],
      ["UC-20", "not built"],
      ["UC-23", "supported"],
      ["UC-24", "partial"],
      ["Q-01", "partial"],
    ]);
  });
});

describe("summarise e2e shards", () => {
  it("adds up each platform's shards and lists the platforms where all passed", () => {
    const shard = (os: string, i: number, n: number) =>
      `test-results-e2e-${os}-latest-shard-${i}-of-${n}/results-e2e.json`;
    const summary = summarise({
      commit: "abc",
      date: "2026-10-04",
      files: [
        ...without("results-e2e.json"),
        { content: playwright(70), path: shard("ubuntu", 1, 2) },
        { content: playwright(68, 0, 1), path: shard("ubuntu", 2, 2) },
        { content: playwright(46), path: shard("macos", 1, 3) },
        { content: playwright(46), path: shard("macos", 2, 3) },
        { content: playwright(46, 1), path: shard("macos", 3, 3) },
      ],
      version: "v1.3.2",
    });

    // Each platform runs the whole suite: one platform's count, not the sum
    expect(summary.layers.e2e).toEqual({
      passed: 139,
      platforms: ["Linux"],
      tests: 139,
    });
  });
});

describe("countStatuses", () => {
  it("refuses an entry with no status, which means the issues weren't read", () => {
    expect(() =>
      countStatuses([
        { id: "UC-19", status: "supported" },
        { id: "UC-23", status: null },
      ]),
    ).toThrow("No status for UC-23");
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
      // No max: the report writes null, which isn't a budget of 0
      budget({
        label: "Opening a kit",
        max: null,
        measured: 6,
        metric: "total",
        name: "open a kit",
        target: null,
      }),
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

describe("groupEntries", () => {
  const tests = (unit: number, integration = 0, e2e = 0, validation = 0) => ({
    e2e,
    integration,
    unit,
    validation,
  });

  it("groups by area and notes a declared test gap", () => {
    const groups = groupEntries([
      {
        gap: null,
        group: "Samples",
        id: "UC-19",
        kind: "use case",
        name: "Drop WAVs onto a voice",
        openIssues: 1,
        status: "partial",
        tests: tests(30, 20, 3),
      },
      {
        gap: "opening `Finder` needs a real desktop.",
        group: "Samples",
        id: "UC-25",
        kind: "use case",
        name: "Reveal a sample",
        openIssues: 0,
        status: "supported",
        tests: tests(6),
      },
      {
        gap: null,
        group: "Samples",
        id: "UC-22",
        kind: "use case",
        name: "Move a sample to another kit",
        openIssues: 0,
        status: "not built",
        tests: tests(3),
      },
      {
        gap: null,
        group: "Qualities",
        id: "Q-06",
        kind: "quality",
        name: "Works with a keyboard",
        openIssues: 0,
        status: "partial",
        tests: tests(0),
      },
    ]);

    expect(groups.map((g) => [g.name, g.kind, g.entries.length])).toEqual([
      ["Samples", "use case", 3],
      ["Qualities", "quality", 1],
    ]);
    expect(groups[0].entries.map((e) => e.followUps)).toEqual([
      [],
      ["No automated test: opening Finder needs a real desktop."],
      [],
    ]);
    expect(groups[1].entries[0].followUps).toEqual([]);
  });
});

// Budget rows as tests/perf/budgets.ts writes them: null for a limit that
// isn't set, as an action's total has no max
const row = (
  label: string,
  metric: string,
  measured: number,
  max: null | number,
  target: null | number = null,
) =>
  budget({
    label,
    max,
    measured,
    metric,
    name: label.toLowerCase(),
    target,
    until: target === null ? null : "RE-36",
  });

describe("[Q-07] summarise a release's artifacts", () => {
  // The layout `gh run download` gives for a release run (37737278662,
  // v1.4.0): one e2e shard per platform, and a validation report whose
  // cancel-setup and performance scenarios sit in subfolders
  let dir: string;
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };
  const vitestRun = (total: number, pending: number) =>
    JSON.stringify({
      numFailedTests: 0,
      numPassedTests: total - pending,
      numPendingTests: pending,
      numTodoTests: 0,
      numTotalTests: total,
    });
  const budgetRows = [
    row("Opening the app", "get-all-kits", 1, 1),
    row("Opening the app", "total", 5, null),
    row("Opening a kit", "get-all-kits", 1, 1, 0),
    row("Opening a kit", "total", 6, null),
    row("Changing a sample's volume", "update-sample-gain", 5, 5),
    row("Changing a sample's volume", "total", 5, null),
  ].join("\n");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "testing-summary-"));
    write("test-results-unit/results-unit.json", vitestRun(4578, 4));
    for (const platform of ["macos", "ubuntu", "windows"]) {
      const pending = platform === "windows" ? 1 : 0;
      write(
        `test-results-integration-${platform}-latest/results-integration.json`,
        vitestRun(752, pending),
      );
      const shard = `test-results-e2e-${platform}-latest-shard-1-of-1`;
      write(`${shard}/results-e2e.json`, playwright(140));
      write(`${shard}/budgets-e2e.jsonl`, `${budgetRows}\n`);
      const report = `validation-report-${platform}-latest/validation-report`;
      write(
        `${report}/report.json`,
        JSON.stringify({
          checks: Array.from({ length: 54 }, (_, i) => ({
            name: `c${i}`,
            status: "pass",
          })),
          facts: {
            "card files converted": 4,
            "card files copied": 2367,
            "kits imported": 183,
            "samples imported": 2366,
          },
        }),
      );
      write(`${report}/report.md`, "# Validation");
      write(`${report}/main.log`, "");
      // The cancel-setup scenario only imports, so it has no card files
      write(
        `${report}/cancel-setup/report.json`,
        JSON.stringify({
          checks: [{ name: "c", status: "pass" }],
          facts: { "kits imported": 183 },
        }),
      );
      write(
        `${report}/performance/report.json`,
        JSON.stringify({ facts: { kits: 183, samples: 2366, setupMs: 1 } }),
      );
    }
  });

  afterEach(() => {
    fs.rmSync(dir, { force: true, recursive: true });
  });

  const run = () =>
    summarise({
      commit: "abc",
      date: "2026-10-08",
      files: findReports(dir),
      version: "v1.4.0",
    });

  it("reads the full pipeline's counts, not a scenario's", () => {
    expect(run().layers.rehearsal).toEqual({
      cardFiles: 2371,
      kits: 183,
      knownIssues: 0,
      passed: 54,
      platforms: ["macOS", "Windows", "Linux"],
      samples: 2366,
      tests: 54,
    });
  });

  it("judges an unbudgeted total as no budget, not as over 0", () => {
    expect(run().performance).toEqual([
      { action: "Opening the app", status: "within" },
      { action: "Opening a kit", status: "improving" },
      { action: "Changing a sample's volume", status: "within" },
    ]);
  });

  it("counts the tests that ran, so a skipped test isn't a failure", () => {
    const { integration, unit } = run().layers;
    expect(unit).toEqual({ passed: 4574, platforms: [], tests: 4574 });
    expect(integration).toEqual({
      passed: 752,
      platforms: ["macOS", "Windows", "Linux"],
      tests: 752,
    });
  });

  it("refuses to summarise without the full pipeline's report", () => {
    for (const platform of ["macos", "ubuntu", "windows"]) {
      fs.rmSync(
        path.join(
          dir,
          `validation-report-${platform}-latest/validation-report/report.json`,
        ),
      );
    }
    expect(run).toThrow("no validation-report/report.json");
  });
});

describe("[Q-07] summarise refuses missing inputs", () => {
  const files = (list: { content: string; path: string }[]) => () =>
    summarise({ commit: "abc", date: "", files: list, version: "v1" });

  it.each([
    ["results-unit.json"],
    ["results-integration.json"],
    ["results-e2e.json"],
    ["report.json"],
  ])("throws when no %s was downloaded", (name) => {
    expect(files(without(name))).toThrow("among the artifacts");
  });

  it("throws when there are no e2e budget rows", () => {
    expect(files(without("budgets-e2e.jsonl"))).toThrow("no e2e budget rows");
  });

  it("throws when the rehearsal has no card file count", () => {
    const report = JSON.stringify({
      checks: [{ name: "c", status: "pass" }],
      facts: { "kits imported": 183 },
    });
    expect(
      files([
        ...without("report.json"),
        {
          content: report,
          path: "validation-report-macos-latest/validation-report/report.json",
        },
      ]),
    ).toThrow('no "card files converted" count');
  });

  it("throws on a report that isn't the expected format", () => {
    expect(
      files([
        ...without("results-unit.json"),
        { content: "{}", path: "test-results-unit/results-unit.json" },
      ]),
    ).toThrow("isn't a Vitest JSON report");
  });
});

describe("[Q-07] isRehearsalReport", () => {
  it("matches the full pipeline's report only", () => {
    const report = "validation-report-macos-latest/validation-report";
    expect(isRehearsalReport(`${report}/report.json`)).toBe(true);
    expect(
      isRehearsalReport(
        String.raw`v-windows-latest\validation-report\report.json`,
      ),
    ).toBe(true);
    expect(isRehearsalReport(`${report}/cancel-setup/report.json`)).toBe(false);
    expect(isRehearsalReport(`${report}/performance/report.json`)).toBe(false);
  });
});

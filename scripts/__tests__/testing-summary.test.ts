// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  countStatuses,
  groupEntries,
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
  // Statuses as traceability.mjs generates them from the open issues
  const entry = (id: string, kind: string, status: string) => ({
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
      summary.groups.flatMap(
        (g: { entries: { id: string; status: string }[] }) =>
          g.entries.map((e) => [e.id, e.status]),
      ),
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
        issues: [{ id: "RE-40", text: "Some failures happen silently." }],
        kind: "use case",
        name: "Drop WAVs onto a voice",
        status: "partial",
        tests: tests(30, 20, 3),
      },
      {
        gap: "opening `Finder` needs a real desktop.",
        group: "Samples",
        id: "UC-25",
        issues: [],
        kind: "use case",
        name: "Reveal a sample",
        status: "supported",
        tests: tests(6),
      },
      {
        gap: null,
        group: "Samples",
        id: "UC-22",
        issues: [],
        kind: "use case",
        name: "Move a sample to another kit",
        status: "not built",
        tests: tests(3),
      },
      {
        gap: null,
        group: "Qualities",
        id: "Q-06",
        issues: [],
        kind: "quality",
        name: "Works with a keyboard",
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

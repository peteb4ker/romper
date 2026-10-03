#!/usr/bin/env node
/**
 * The testing summary a release publishes (docs/testing.md shows it).
 *
 *   node scripts/testing-summary.mjs <artifacts-dir> --version v1.3.2 \
 *     --commit <sha> --out testing-summary.json
 *
 * Reads what the release run's checks produced, as downloaded artifacts:
 * - `results-unit.json`, `results-integration.json`: Vitest JSON reports;
 * - `results-e2e.json`: Playwright's JSON report;
 * - `validation-report/report.json`: the full-pipeline rehearsal;
 * - `*.jsonl` performance budget rows (`tests/perf/budgets.ts`).
 * An artifact folder named `...-<os>-latest` says which platform ran it.
 * Use case status comes from the register, docs/developer/use-cases.md.
 *
 * The output is small and stable; the site copies it from the latest release
 * at build time, so no count is ever committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildIndex,
  findTestFiles,
  parseBacklog,
  parseRegister,
  summarise as summariseEntries,
} from "./traceability.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORMS = { macos: "macOS", ubuntu: "Linux", windows: "Windows" };

/** "Linux" for a path through an artifact named like `x-ubuntu-latest` */
export function platformOf(file) {
  const match = /(ubuntu|macos|windows)-latest/.exec(file);
  return match ? PLATFORMS[match[1]] : undefined;
}

const ORDER = ["macOS", "Windows", "Linux"];
const sortPlatforms = (set) =>
  [...set].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

/**
 * Use cases and qualities for the testing page, grouped by area in register
 * order. Everything still to do is a GitHub issue labelled with the entry's ID,
 * which the page counts live; the only note kept here is a declared test gap,
 * a test that can't be automated, so readers see why there's none.
 */
export function groupEntries(entries) {
  const groups = [];
  for (const entry of entries) {
    const followUps = entry.gap
      ? [`No automated test: ${entry.gap.replaceAll("`", "")}`]
      : [];
    let group = groups.at(-1);
    if (group?.name !== entry.group) {
      group = { entries: [], kind: entry.kind, name: entry.group };
      groups.push(group);
    }
    group.entries.push({
      followUps,
      id: entry.id,
      name: entry.name,
      status: entry.status,
      tests: entry.tests,
    });
  }
  return groups;
}

/**
 * Summarise a release run.
 * @param {{ path: string, content: string }[]} files report files found
 */
export function summarise({
  commit,
  date,
  entries = [],
  files,
  useCases,
  version,
}) {
  const layer = () => ({ passed: 0, platforms: new Set(), tests: 0 });
  const layers = {
    e2e: layer(),
    integration: layer(),
    rehearsal: { ...layer(), facts: {} },
    unit: layer(),
  };
  const budgets = [];

  const add = (target, file, tests, passed) => {
    // Each platform runs the same tests: report one platform's count
    target.tests = Math.max(target.tests, tests);
    target.passed = Math.max(target.passed, passed);
    const platform = platformOf(file);
    if (platform && passed === tests) target.platforms.add(platform);
  };

  for (const { content, path: file } of files) {
    const name = path.basename(file);
    if (name.endsWith(".jsonl")) {
      for (const line of content.split("\n")) {
        if (line.trim()) budgets.push(JSON.parse(line));
      }
      continue;
    }
    const json = JSON.parse(content);
    if (name === "results-unit.json" || name === "results-integration.json") {
      const target =
        name === "results-unit.json" ? layers.unit : layers.integration;
      add(target, file, json.numTotalTests, json.numPassedTests);
    } else if (name === "results-e2e.json") {
      const { expected = 0, flaky = 0, unexpected = 0 } = json.stats ?? {};
      add(layers.e2e, file, expected + flaky + unexpected, expected + flaky);
    } else if (name === "report.json" && file.includes("validation-report")) {
      if (file.includes("performance")) continue;
      // A "known" check is a failure tied to an open finding (knownBug)
      const checks = json.checks ?? [];
      const known = checks.filter((c) => c.status === "known").length;
      add(
        layers.rehearsal,
        file,
        checks.length - known,
        checks.filter((c) => c.status === "pass").length,
      );
      layers.rehearsal.knownIssues = Math.max(
        layers.rehearsal.knownIssues ?? 0,
        known,
      );
      if (Object.keys(layers.rehearsal.facts).length === 0) {
        layers.rehearsal.facts = json.facts ?? {};
      }
    }
  }

  const facts = layers.rehearsal.facts;
  const number = (key) => (typeof facts[key] === "number" ? facts[key] : 0);
  const finish = ({ facts: _facts, platforms, ...rest }) => ({
    ...rest,
    platforms: sortPlatforms(platforms),
  });

  return {
    commit,
    date,
    layers: {
      e2e: finish(layers.e2e),
      integration: finish(layers.integration),
      rehearsal: {
        ...finish(layers.rehearsal),
        cardFiles: number("card files copied") + number("card files converted"),
        kits: number("kits imported"),
        samples: number("samples imported"),
      },
      unit: finish(layers.unit),
    },
    groups: groupEntries(entries),
    performance: summariseBudgets(budgets),
    useCases: {
      notBuilt: useCases.filter((u) => u.status === "not built").length,
      partial: useCases.filter((u) => u.status === "partial").length,
      supported: useCases.filter((u) => u.status === "supported").length,
      total: useCases.length,
    },
    version,
  };
}

/**
 * One row per user action (the e2e budgets): within budget, within budget
 * with an improvement planned, or over budget (a release can't be).
 */
export function summariseBudgets(rows) {
  const actions = new Map();
  for (const row of rows.filter((r) => r.suite === "e2e")) {
    // Budgets give each action a plain-language label for the public page
    const action =
      row.label ?? row.name.charAt(0).toUpperCase() + row.name.slice(1);
    const status = actions.get(action) ?? "within";
    const next =
      row.measured > row.max
        ? "over"
        : row.target === undefined
          ? "within"
          : "improving";
    const rank = { improving: 1, over: 2, within: 0 };
    actions.set(action, rank[next] > rank[status] ? next : status);
  }
  return [...actions.entries()].map(([action, status]) => ({
    action,
    status,
  }));
}

/** Every report file under `dir` */
export function findReports(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        /^results-(unit|integration|e2e)\.json$/.test(entry.name) ||
        entry.name.endsWith(".jsonl") ||
        (entry.name === "report.json" && full.includes("validation-report"))
      ) {
        out.push({
          content: fs.readFileSync(full, "utf8"),
          path: path.relative(dir, full),
        });
      }
    }
  };
  walk(dir);
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [dir, ...rest] = process.argv.slice(2);
  const option = (name) => {
    const i = rest.indexOf(`--${name}`);
    return i === -1 ? undefined : rest[i + 1];
  };
  if (!dir) {
    console.error(
      "Usage: testing-summary.mjs <artifacts-dir> --version <tag> --commit <sha> [--out file]",
    );
    process.exit(2);
  }
  const { useCases: entries } = parseRegister(
    fs.readFileSync(path.join(ROOT, "docs/developer/use-cases.md"), "utf8"),
  );
  // Use case status and counts are for use cases only; qualities are listed
  // with them on the page
  const useCases = entries.filter((e) => e.kind === "use case");
  const scan = buildIndex(findTestFiles(ROOT), (f) =>
    fs.readFileSync(path.join(ROOT, f), "utf8"),
  );
  const backlog = parseBacklog(
    fs.readFileSync(path.join(ROOT, "BACKLOG.md"), "utf8"),
  );
  const summary = summarise({
    commit: option("commit") ?? "",
    date: new Date().toISOString().slice(0, 10),
    entries: summariseEntries(entries, scan, backlog),
    files: findReports(dir),
    useCases,
    version: option("version") ?? "",
  });
  const json = `${JSON.stringify(summary, null, 2)}\n`;
  const out = option("out");
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json);
  } else process.stdout.write(json);
}

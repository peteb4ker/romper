#!/usr/bin/env node
/**
 * The testing summary a release publishes (docs/testing.md shows it).
 *
 *   node scripts/testing-summary.mjs <artifacts-dir> --version v1.3.2 \
 *     --commit <sha> --out testing-summary.json
 *
 * Reads what the release run's checks produced, as downloaded artifacts:
 * - `results-unit.json`, `results-integration.json`: Vitest JSON reports;
 * - `results-e2e.json`: Playwright's JSON report, one per shard (#660);
 * - `validation-report/report.json`: the full-pipeline rehearsal (not the
 *   cancel-setup or performance scenarios in its subfolders);
 * - `*.jsonl` performance budget rows (`tests/perf/budgets.ts`).
 * It exits non-zero, rather than publishing 0s, if any of them is missing.
 * An artifact folder named `...-<os>-latest` says which platform ran it.
 * Use case status is generated from the open GitHub issues
 * (`deriveStatuses` in traceability.mjs), read with `gh` as the release
 * runs, so it needs GH_TOKEN with issues: read; "not built" comes from the
 * register, docs/developer/use-cases.md.
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
  parseRegister,
  readGitHub,
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

/** The full-pipeline report; other scenarios get their own subfolders */
const REHEARSAL = /(^|\/)validation-report\/report\.json$/;

/** True for the full pipeline's report, not a scenario's or performance's */
export function isRehearsalReport(file) {
  return REHEARSAL.test(file.replaceAll("\\", "/"));
}

/** Rehearsal facts the page shows, by the name report.json gives them */
const FACTS = {
  cardFilesConverted: "card files converted",
  cardFilesCopied: "card files copied",
  kits: "kits imported",
  samples: "samples imported",
};

const fail = (message) => {
  throw new Error(`testing-summary: ${message}`);
};

/** A Vitest JSON report's run count: skipped and todo tests didn't run */
function vitestCounts(json, file) {
  const total = json.numTotalTests;
  const passed = json.numPassedTests;
  if (!Number.isInteger(total) || !Number.isInteger(passed)) {
    fail(`${file} isn't a Vitest JSON report (no numTotalTests)`);
  }
  const notRun = (json.numPendingTests ?? 0) + (json.numTodoTests ?? 0);
  return { passed, tests: total - notRun };
}

/**
 * Summarise a release run. Throws, rather than writing 0s, when a report
 * the page needs is missing or isn't in the shape it expects.
 * @param {{ path: string, content: string }[]} files report files found
 * @param entries every use case and quality, with its generated status
 *   (traceability.mjs `summarise`, given the open issues)
 */
export function summarise({ commit, date, entries = [], files, version }) {
  const layer = () => ({ passed: 0, platforms: new Set(), tests: 0 });
  const layers = {
    e2e: layer(),
    integration: layer(),
    rehearsal: { ...layer(), facts: undefined },
    unit: layer(),
  };
  const budgets = [];
  const seen = { e2e: 0, integration: 0, rehearsal: 0, unit: 0 };
  // CI runs the e2e suite in shards, each with its own report: a platform's
  // results are the sum of its shards'
  const e2eShards = new Map();

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
      const kind = name === "results-unit.json" ? "unit" : "integration";
      const { passed, tests } = vitestCounts(json, file);
      add(layers[kind], file, tests, passed);
      seen[kind] += 1;
    } else if (name === "results-e2e.json") {
      if (!json.stats)
        fail(`${file} isn't a Playwright JSON report (no stats)`);
      const { expected = 0, flaky = 0, unexpected = 0 } = json.stats;
      const key = platformOf(file) ?? file;
      const shards = e2eShards.get(key) ?? { file, passed: 0, tests: 0 };
      shards.tests += expected + flaky + unexpected;
      shards.passed += expected + flaky;
      e2eShards.set(key, shards);
      seen.e2e += 1;
    } else if (isRehearsalReport(file)) {
      // A "known" check is a failure tied to an open finding (knownBug)
      const checks = json.checks ?? [];
      if (checks.length === 0) fail(`${file} has no checks`);
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
      layers.rehearsal.facts ??= rehearsalFacts(json.facts, file);
      seen.rehearsal += 1;
    }
  }

  for (const { file, passed, tests } of e2eShards.values()) {
    add(layers.e2e, file, tests, passed);
  }

  const missing = Object.entries({
    e2e: "results-e2e.json",
    integration: "results-integration.json",
    rehearsal: "validation-report/report.json",
    unit: "results-unit.json",
  }).filter(([kind]) => seen[kind] === 0);
  if (missing.length > 0) {
    fail(`no ${missing.map(([, f]) => f).join(", ")} among the artifacts`);
  }
  const performance = summariseBudgets(budgets);
  if (performance.length === 0) {
    fail("no e2e budget rows (budgets-e2e.jsonl) among the artifacts");
  }

  const facts = layers.rehearsal.facts;
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
        cardFiles: facts.cardFilesCopied + facts.cardFilesConverted,
        kits: facts.kits,
        samples: facts.samples,
      },
      unit: finish(layers.unit),
    },
    groups: groupEntries(entries),
    performance,
    useCases: countStatuses(entries.filter((e) => e.kind === "use case")),
    version,
  };
}

/** The page's rehearsal figures, each a count the report must give */
function rehearsalFacts(facts = {}, file) {
  const out = {};
  for (const [key, label] of Object.entries(FACTS)) {
    if (typeof facts[label] !== "number") {
      fail(`${file} has no "${label}" count in its facts`);
    }
    out[key] = facts[label];
  }
  return out;
}

/**
 * Use cases per status, for the page's bar. Qualities are listed with them
 * on the page but not counted. Every entry needs a status: the release reads
 * the issues, so none is unknown.
 */
export function countStatuses(useCases) {
  const unknown = useCases.filter((u) => !u.status).map((u) => u.id);
  if (unknown.length > 0) {
    throw new Error(
      `No status for ${unknown.join(", ")}: summarise the entries with the open issues.`,
    );
  }
  const count = (status) => useCases.filter((u) => u.status === status).length;
  return {
    notBuilt: count("not built"),
    partial: count("partial"),
    supported: count("supported"),
    total: useCases.length,
  };
}

/**
 * One row per user action (the e2e budgets): within budget, within budget
 * with an improvement planned, or over budget (a release can't be). The
 * report writes `null` for a limit that isn't set (`budgetReportRows` in
 * tests/perf/budgets.ts): a metric with no max, such as an action's total,
 * isn't budgeted, so it doesn't count either way.
 */
export function summariseBudgets(rows) {
  const actions = new Map();
  const rank = { improving: 1, over: 2, within: 0 };
  for (const row of rows.filter((r) => r.suite === "e2e")) {
    if (typeof row.measured !== "number") {
      fail(`budget row ${row.name}/${row.metric} has no measured value`);
    }
    // Budgets give each action a plain-language label for the public page
    const action =
      row.label ?? row.name.charAt(0).toUpperCase() + row.name.slice(1);
    const status = actions.get(action) ?? "within";
    const budgeted = typeof row.max === "number";
    let next = "within";
    if (budgeted && row.measured > row.max) next = "over";
    else if (budgeted && typeof row.target === "number") next = "improving";
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
        isRehearsalReport(path.relative(dir, full))
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
  const { errors, useCases: register } = parseRegister(
    fs.readFileSync(path.join(ROOT, "docs/developer/use-cases.md"), "utf8"),
  );
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  // Statuses come from the open issues as the release ships. The page
  // still counts each entry's open issues live.
  let github;
  try {
    github = readGitHub({ root: ROOT });
  } catch (error) {
    const reason = String(error.stderr || error.message)
      .trim()
      .split("\n")[0];
    console.error(
      `Can't read the GitHub issues the use case statuses come from (${reason}). The step needs GH_TOKEN with issues: read.`,
    );
    process.exit(1);
  }
  const scan = buildIndex(findTestFiles(ROOT), (f) =>
    fs.readFileSync(path.join(ROOT, f), "utf8"),
  );
  let summary;
  try {
    summary = summarise({
      commit: option("commit") ?? "",
      date: new Date().toISOString().slice(0, 10),
      entries: summariseEntries(register, scan, github),
      files: findReports(dir),
      version: option("version") ?? "",
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const json = `${JSON.stringify(summary, null, 2)}\n`;
  const out = option("out");
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json);
  } else process.stdout.write(json);
}

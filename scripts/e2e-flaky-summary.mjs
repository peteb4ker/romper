#!/usr/bin/env node
/**
 * Lists the e2e tests that passed only when CI retried them (#659).
 *
 *   node scripts/e2e-flaky-summary.mjs reports/results-e2e.json \
 *     --platform ubuntu-latest
 *
 * On CI, Playwright retries a failed test once (playwright.config.ts). A
 * test that fails, then passes, is "flaky" in Playwright's JSON report and
 * doesn't fail the run, so this step makes each one visible: a table in the
 * job summary ($GITHUB_STEP_SUMMARY, or stdout without it) and a warning
 * annotation on the spec. A pass on retry is a flaky test to file as an
 * issue, not a pass. The step never fails the job; Playwright's own exit
 * code does that.
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

const MAX_ERROR = 200;

/**
 * The parts of Playwright's JSON report (`JSONReport` in
 * `@playwright/test/reporter`) read here.
 * @typedef {{ error?: { message?: string }, status: string }} ReportResult
 * @typedef {{ results?: ReportResult[], status: string }} ReportTest
 * @typedef {{ file?: string, line?: number, tests?: ReportTest[], title: string }} ReportSpec
 * @typedef {object} ReportSuite
 * @property {string} [file]
 * @property {ReportSpec[]} [specs]
 * @property {ReportSuite[]} [suites]
 * @property {string} title a spec file's name, or a describe's title
 * @typedef {{ suites?: ReportSuite[] }} Report
 *
 * @typedef {{ error: string, file: string, line: number, title: string }} FlakyTest
 */

/**
 * The tests Playwright reports as flaky, with where they are and what the
 * failed attempt said.
 * @param {Report | undefined} report
 * @returns {FlakyTest[]}
 */
export function flakyTests(report) {
  /** @type {FlakyTest[]} */
  const found = [];
  /**
   * @param {ReportSuite} suite
   * @param {string[]} titles
   */
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status !== "flaky") continue;
        const failed = (test.results ?? []).find(
          (result) => !["passed", "skipped"].includes(result.status),
        );
        found.push({
          error: firstLine(failed?.error?.message ?? failed?.status ?? ""),
          file: spec.file ?? suite.file ?? "",
          line: spec.line ?? 0,
          title: [...titles, spec.title].join(" › "),
        });
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child, [...titles, child.title]);
    }
  };
  // A top-level suite is a spec file; its title is the file name
  for (const suite of report?.suites ?? []) walk(suite, []);
  return found;
}

/**
 * The job summary section for one platform's run
 * @param {FlakyTest[]} flaky
 * @param {string} [platform]
 */
export function summaryMarkdown(flaky, platform) {
  const heading = `### E2E retries${platform ? ` (${platform})` : ""}`;
  if (flaky.length === 0) {
    return `${heading}\n\nNo test needed a retry.\n`;
  }
  const rows = flaky.map(
    (test) =>
      `| ${cell(test.title)} | \`${cell(test.file)}:${test.line}\` | ${cell(test.error)} |`,
  );
  return [
    heading,
    "",
    `**${flaky.length} ${flaky.length === 1 ? "test" : "tests"} failed, then passed when CI retried ${flaky.length === 1 ? "it" : "them"}.** ` +
      "A pass on retry is a flaky test, not a pass: file an issue for each " +
      "one (see BACKLOG.md), with the failure below and a link to this run, " +
      "so the retry doesn't hide it.",
    "",
    "| Test | Spec | First attempt failed with |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/**
 * GitHub Actions warning annotations, one per flaky test
 * @param {FlakyTest[]} flaky
 */
export function annotations(flaky) {
  return flaky.map(
    (test) =>
      `::warning file=${test.file},line=${test.line},title=Flaky e2e test::` +
      `${escapeAnnotation(test.title)} failed, then passed on retry. File an issue for it.`,
  );
}

/** @param {string} text */
function firstLine(text) {
  const line = stripVTControlCharacters(String(text)).trim().split("\n")[0];
  return line.length > MAX_ERROR ? `${line.slice(0, MAX_ERROR - 1)}…` : line;
}

/** @param {string} text */
function cell(text) {
  return String(text).replaceAll("|", String.raw`\|`);
}

/** @param {string} text */
function escapeAnnotation(text) {
  return String(text)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const flag = args.indexOf("--platform");
  const platform = flag === -1 ? undefined : args[flag + 1];
  const file =
    args.find(
      (arg, i) => !arg.startsWith("--") && (flag === -1 || i !== flag + 1),
    ) ?? "reports/results-e2e.json";

  let markdown;
  if (fs.existsSync(file)) {
    const flaky = flakyTests(JSON.parse(fs.readFileSync(file, "utf8")));
    for (const line of annotations(flaky)) console.log(line);
    markdown = summaryMarkdown(flaky, platform);
  } else {
    markdown = `### E2E retries${platform ? ` (${platform})` : ""}\n\nNo Playwright report at \`${file}\`: the tests didn't run.\n`;
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  } else {
    process.stdout.write(markdown);
  }
}

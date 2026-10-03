/**
 * "Fixed in this release" for the release notes.
 *
 * GitHub issues are Romper's backlog. Each issue's title says what a user
 * notices, and fix PRs say `Fixes #N`, so merging the PR closes the issue as
 * completed. The issues closed as completed since the previous release are
 * therefore the problems this release fixes. They're grouped by their use
 * case (`UC-NN`) or quality (`Q-NN`) label, under the label's description.
 */

import { execFileSync } from "node:child_process";

/** Labels whose issues never appear in the notes. */
const SKIPPED_LABELS = new Set(["duplicate", "ops"]);

/** Use cases come before qualities; each in numeric order. */
const GROUP_KINDS = ["UC", "Q"];
const GROUP_LABEL = /^(UC|Q)-(\d+)$/;

const OTHER_GROUP = { heading: "Other fixes", id: null };

/**
 * GitHub closes a `Fixes #N` issue a few seconds after it lands the PR's
 * commits, so an issue fixed by the tagged commit itself closes just after
 * that commit's date. Both ends of the window move by this much, so such an
 * issue counts toward the release whose tag is on its fix, and windows of
 * consecutive releases still meet without a gap or overlap.
 */
const CLOSE_GRACE_MS = 5 * 60 * 1000;

/**
 * Sort key for a use case or quality label, or null for any other label.
 */
function groupLabelKey(name) {
  const match = GROUP_LABEL.exec(name);
  if (!match) return null;
  return [GROUP_KINDS.indexOf(match[1]), Number(match[2])];
}

function compareKeys(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * The label an issue is listed under: its first use case or quality label
 * in ID order. An issue that touches several use cases is listed once.
 */
function primaryGroupLabel(labels) {
  return (
    labels
      .filter((label) => groupLabelKey(label.name))
      .sort((a, b) =>
        compareKeys(groupLabelKey(a.name), groupLabelKey(b.name)),
      )[0] ?? null
  );
}

/**
 * Escape an issue title for use as markdown link text.
 */
function escapeMarkdown(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([[\]])/g, "\\$1")
    .replace(/</g, "&lt;");
}

/**
 * Group closed issues for the notes.
 *
 * `issues` are GitHub REST issue objects (`number`, `title`, `html_url`,
 * `state_reason`, `closed_at`, `labels: [{ name, description }]`). Only
 * issues closed as completed in (from, to] are kept, so an issue closed
 * exactly at the previous release isn't listed twice. Returns
 * `[{ id, heading, issues: [{ number, title, url, line }] }]`, use cases
 * first, then qualities, then issues with neither.
 */
function groupFixedIssues(issues, { from = null, to = null } = {}) {
  const fromMs = from ? Date.parse(from) : -Infinity;
  const toMs = to ? Date.parse(to) : Infinity;
  const groups = new Map();

  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (issue.state_reason !== "completed") continue;

    const closedMs = Date.parse(issue.closed_at);
    if (!(closedMs > fromMs && closedMs <= toMs)) continue;

    const labels = (issue.labels ?? []).map((label) =>
      typeof label === "string" ? { description: "", name: label } : label,
    );
    if (labels.some((label) => SKIPPED_LABELS.has(label.name))) continue;

    const primary = primaryGroupLabel(labels);
    const id = primary ? primary.name : OTHER_GROUP.id;
    if (!groups.has(id)) {
      groups.set(id, {
        heading: primary
          ? escapeMarkdown(primary.description?.trim() || primary.name)
          : OTHER_GROUP.heading,
        id,
        issues: [],
      });
    }

    const title = issue.title.trim();
    groups.get(id).issues.push({
      line: `[${escapeMarkdown(title)}](${issue.html_url})`,
      number: issue.number,
      title,
      url: issue.html_url,
    });
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return compareKeys(groupLabelKey(a.id), groupLabelKey(b.id));
    })
    .map((group) => ({
      ...group,
      issues: group.issues.sort((a, b) => a.number - b.number),
    }));
}

/**
 * The closed-at window for a release, from the previous tag's commit date
 * (null for the first release) to the tagged commit's date.
 */
function releaseWindow(previousTagDate, tagDate) {
  const shift = (date) =>
    date ? new Date(Date.parse(date) + CLOSE_GRACE_MS).toISOString() : null;
  return { from: shift(previousTagDate), to: shift(tagDate) };
}

/**
 * GitHub search dates: UTC, whole seconds.
 */
function searchDate(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * The search query for issues closed as completed in [from, to].
 */
function buildSearchQuery(repo, { from = null, to = null } = {}) {
  let closed;
  if (from && to) closed = `closed:${searchDate(from)}..${searchDate(to)}`;
  else if (from) closed = `closed:>=${searchDate(from)}`;
  else if (to) closed = `closed:<=${searchDate(to)}`;

  return [
    `repo:${repo}`,
    "is:issue",
    "is:closed",
    "reason:completed",
    closed,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Run `gh` and return its stdout. Uses GH_TOKEN in CI, or the local gh login.
 */
function runGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Fetch issues closed as completed in [from, to] through the search API.
 * `gh` is injectable so tests never touch the network.
 */
function fetchClosedIssues(repo, range, { gh = runGh } = {}) {
  const output = gh([
    "api",
    "--method",
    "GET",
    "search/issues",
    "--paginate",
    "-f",
    `q=${buildSearchQuery(repo, range)}`,
    "-f",
    "per_page=100",
    "--jq",
    ".items[]",
  ]);

  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Write a notice to stderr. Stdout carries the notes themselves, which the
 * release workflow captures; in GitHub Actions the notice is a warning on
 * the run.
 */
function logNotice(message) {
  const prefix = process.env.GITHUB_ACTIONS === "true" ? "::warning::" : "";
  console.error(`${prefix}${message}`);
}

/**
 * The grouped fixed issues for a release, or null when GitHub can't be
 * queried (no token, no gh, no network), so local runs still produce notes.
 */
function getFixedIssueGroups(
  repo,
  range,
  { gh = runGh, log = logNotice } = {},
) {
  let issues;
  try {
    issues = fetchClosedIssues(repo, range, { gh });
  } catch (error) {
    const detail = String(error.stderr || error.message || "")
      .replace(/\s+/g, " ")
      .trim();
    log(
      `Release notes: leaving out "Fixed in this release" because GitHub issues couldn't be read (set GH_TOKEN or run gh auth login). ${detail}`.trim(),
    );
    return null;
  }

  return groupFixedIssues(issues, range);
}

export {
  buildSearchQuery,
  fetchClosedIssues,
  getFixedIssueGroups,
  groupFixedIssues,
  groupLabelKey,
  releaseWindow,
};

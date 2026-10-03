#!/usr/bin/env node
/**
 * Use case traceability (RE-67).
 *
 *   npm run trace         # print each entry's status; write
 *                         # docs/developer/traceability.md (not committed)
 *   npm run trace:check   # fail on unknown IDs or closed test gaps; warn on
 *                         # what a release can't ship with
 *   ... --strict-issues   # fail on those too (the release)
 *   ... --json <file>     # also write the per-entry summary (testing page)
 *
 * Reads the use case register (docs/developer/use-cases.md) and the
 * `[UC-NN]` tags in test titles, and writes a use case x test layer matrix.
 * A tag on a `describe` covers every test inside it.
 *
 * The backlog is GitHub issues, each labelled with the use case or quality
 * (`UC-NN`, `Q-NN`) where a user would notice it. The labels are the trace,
 * and they set each entry's status: supported when no open issue carries
 * its label, partial when at least one does. Status is generated, never
 * written in the register, so a fix PR doesn't touch it: closing the issue
 * is enough. Only "not built" is set by hand (`**Status:** not built`),
 * because no issue can say it; open issues on a not-built entry (building
 * it, say) don't change it. Any other `**Status:**` line is an error.
 *
 * The check always fails when:
 * - a test names a use case the register doesn't have;
 * - a declared test gap (a `**Test gap:**` line) is closed: the line must go;
 * - the register has a hand-set supported or partial status.
 *
 * The issue checks need GitHub, and say what a release can't ship with: an
 * open issue with a UC/Q label the register lacks, an entry with no label on
 * GitHub, and a supported entry with no test above unit level that doesn't
 * declare the gap. On a pull request they're warnings (`::warning::`
 * annotations and the job summary), because anyone can open or close an
 * issue and that mustn't turn every PR red. With `--strict-issues`, as the
 * release runs it, they fail. Issues the current pull request fixes
 * (`Fixes #N`) count as closed, so a fix PR's summary shows the status its
 * merge brings.
 *
 * An issue labelled `triage`, or with no UC/Q label, needs triage: it's
 * listed as a notice, never fails, and doesn't count towards a status.
 *
 * Issues are read with `gh`. Without it (offline, or not signed in), the
 * issue checks are skipped with a notice and statuses show as unknown;
 * `--strict-issues` fails instead.
 *
 * The matrix is generated, never committed: its counts change with every
 * new test, and a committed copy went stale on almost every PR. In CI the
 * check also writes it to the job summary (GITHUB_STEP_SUMMARY), with links
 * to the commit it ran on.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = "docs/developer/use-cases.md";
const OUTPUT = "docs/developer/traceability.md";

export const LAYERS = ["unit", "integration", "e2e", "validation"];
const LAYER_LABELS = {
  e2e: "E2E",
  integration: "Integration",
  unit: "Unit",
  validation: "Validation",
};
/** The only status set by hand; supported and partial come from the issues. */
const NOT_BUILT = "not built";
export const STATUSES = ["supported", "partial", NOT_BUILT];
const ISSUES_URL = "https://github.com/peteb4ker/romper/issues";

const SKIP_DIRS = new Set([
  ".claude",
  ".git",
  "_site",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
  "validation-report",
  "worktrees",
]);

/** The layer a test file belongs to, from its name; null if it isn't a test. */
export function layerOf(file) {
  const posix = file.split(path.sep).join("/");
  if (/(^|\/)tests\/validation\/[^/]+\.validation\.ts$/.test(posix)) {
    return "validation";
  }
  if (!/\.test\.tsx?$/.test(posix)) return null;
  if (/\.e2e\.test\.tsx?$/.test(posix)) return "e2e";
  if (/\.integration\.test\.tsx?$/.test(posix)) return "integration";
  return "unit";
}

/** Every test file under `root`, as sorted repo-relative POSIX paths. */
export function findTestFiles(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const rel = path.relative(root, path.join(dir, entry.name));
        if (layerOf(rel)) found.push(rel.split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * Parse the register: `### UC-NN Name` (use cases) and `### Q-NN Name`
 * (qualities) headings under `## Group` headings. Collects each entry's
 * declared test gap, and marks the entries with `**Status:** not built`.
 * Every other status is generated (`deriveStatuses`), so the register
 * mustn't set one.
 */
export function parseRegister(markdown) {
  const useCases = [];
  const errors = [];
  let current = null;
  let group = null;
  let inGap = false;
  for (const line of markdown.split("\n")) {
    const heading = /^### ((UC|Q)-\d{2}) (.+?)\s*$/.exec(line);
    if (heading) {
      current = {
        gap: null,
        group,
        id: heading[1],
        kind: heading[2] === "Q" ? "quality" : "use case",
        name: heading[3],
        notBuilt: false,
      };
      useCases.push(current);
      inGap = false;
      continue;
    }
    const section = /^## (.+?)\s*$/.exec(line);
    if (section) group = section[1];
    if (/^#{1,3} /.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    // A gap's text runs on until a blank line or the next field or list.
    if (inGap && line.trim() && !/^(\*\*|- |#)/.test(line)) {
      current.gap += ` ${line.trim()}`;
      continue;
    }
    inGap = false;
    const status = /^\*\*Status:\*\*\s*(.+?)\s*$/.exec(line);
    if (status) {
      if (status[1].toLowerCase().startsWith(NOT_BUILT))
        current.notBuilt = true;
      else {
        errors.push(
          `${current.id}: remove its "**Status:** ${status[1]}" line from ${REGISTER}. ` +
            `Supported and partial are generated from the open issues; only "${NOT_BUILT}" is set by hand.`,
        );
      }
    }
    const gap = /^\*\*Test gap:\*\*\s*(.+?)\s*$/.exec(line);
    if (gap) {
      current.gap = gap[1];
      inGap = true;
    }
  }
  const seen = new Set();
  for (const uc of useCases) {
    if (seen.has(uc.id)) errors.push(`${uc.id} appears twice in ${REGISTER}`);
    seen.add(uc.id);
  }
  return { errors, useCases };
}

const HOOK_NAMES = new Set([
  "afterAll",
  "afterEach",
  "beforeAll",
  "beforeEach",
  "extend",
  "info",
  "setTimeout",
  "step",
  "use",
]);

/**
 * Name chain of a call's callee: `test.describe.serial(...)` gives
 * ["test", "describe", "serial"]; `it.each(rows)(...)` gives ["it", "each"].
 */
function calleeChain(expr) {
  if (ts.isIdentifier(expr)) return [expr.text];
  if (ts.isPropertyAccessExpression(expr)) {
    const left = calleeChain(expr.expression);
    return left && [...left, expr.name.text];
  }
  if (ts.isCallExpression(expr)) return calleeChain(expr.expression);
  return null;
}

function titleText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) return node.getText().slice(1, -1);
  return null;
}

/**
 * The tests in one file and the use cases each one covers. A test is
 * covered by the tags in its own title and in every enclosing describe.
 */
export function scanTests(source, fileName = "test.ts") {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const tests = [];
  const tags = [];
  const visit = (node, inherited) => {
    let next = inherited;
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const chain = calleeChain(node.expression);
      const title = titleText(node.arguments[0]);
      if (
        chain &&
        title !== null &&
        ["describe", "it", "test"].includes(chain[0]) &&
        !chain.some((name) => HOOK_NAMES.has(name))
      ) {
        const kind = chain.includes("describe") ? "describe" : "test";
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const own = [...title.matchAll(/\[((?:UC|Q)-\d+)\]/g)].map((m) => m[1]);
        for (const id of own) tags.push({ id, line, title });
        const covered = [...inherited];
        for (const id of own) {
          if (!covered.some((c) => c.id === id)) covered.push({ id, line });
        }
        if (kind === "test") tests.push({ covered, line, title });
        else next = covered;
      }
    }
    ts.forEachChild(node, (child) => visit(child, next));
  };
  visit(sf, []);
  return { tags, tests };
}

/** Collect tagged tests per use case and layer. */
export function buildIndex(files, readFile) {
  const index = new Map(); // id -> layer -> file -> { count, line }
  const tags = [];
  let total = 0;
  let tagged = 0;
  for (const file of files) {
    const layer = layerOf(file);
    const scan = scanTests(readFile(file), file);
    total += scan.tests.length;
    for (const tag of scan.tags) tags.push({ ...tag, file });
    for (const test of scan.tests) {
      if (test.covered.length > 0) tagged += 1;
      for (const { id, line } of test.covered) {
        if (!index.has(id)) index.set(id, new Map());
        const byLayer = index.get(id);
        if (!byLayer.has(layer)) byLayer.set(layer, new Map());
        const byFile = byLayer.get(layer);
        const entry = byFile.get(file) ?? { count: 0, line };
        entry.count += 1;
        entry.line = Math.min(entry.line, line);
        byFile.set(file, entry);
      }
    }
    // A tag on a describe with no tests in it still names a use case.
    for (const tag of scan.tags) {
      if (!index.has(tag.id)) index.set(tag.id, new Map());
    }
  }
  return { index, tagged, tags, total };
}

function countIn(index, id, layer) {
  const byFile = index.get(id)?.get(layer);
  if (!byFile) return 0;
  let n = 0;
  for (const { count } of byFile.values()) n += count;
  return n;
}

const aboveUnit = (index, id) =>
  LAYERS.slice(1).some((layer) => countIn(index, id, layer) > 0);

/** GitHub's heading anchor for a heading's text. */
export function slug(text) {
  return text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replaceAll(/\s/g, "-");
}

/** Issues that aren't work items, so they need no use case or quality. */
const EXEMPT_LABELS = new Set([
  "dependencies",
  "duplicate",
  "invalid",
  "question",
]);
const ID_LABEL = /^(?:UC|Q)-\d+$/;
/** New issues wait here until someone gives them a UC/Q, kind and severity. */
const TRIAGE = "triage";

function gh(exec, root, args) {
  return exec("gh", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const lines = (out) => out.split("\n").filter(Boolean);

/**
 * The issues the current pull request closes when it merges (`Fixes #N`):
 * in GitHub Actions the PR being checked, locally the current branch's PR.
 */
function closingIssues(exec, root, env) {
  const pr = /^refs\/pull\/(\d+)\//.exec(env.GITHUB_REF ?? "")?.[1];
  if (env.GITHUB_ACTIONS === "true" && !pr) return [];
  try {
    const out = gh(exec, root, [
      "pr",
      "view",
      ...(pr ? [pr] : []),
      "--json",
      "closingIssuesReferences",
      "--jq",
      ".closingIssuesReferences[].number",
    ]);
    return lines(out).map(Number);
  } catch (error) {
    if (pr) throw error; // the pull request being checked must be readable
    return []; // no pull request for this branch
  }
}

/**
 * Open issues (not pull requests) with their label names, every label in
 * the repository, and the issues the current pull request fixes. Throws
 * when `gh` is missing or can't reach GitHub.
 */
export function readGitHub({
  env = process.env,
  exec = execFileSync,
  root = ROOT,
} = {}) {
  const issues = lines(
    gh(exec, root, [
      "api",
      "--paginate",
      "repos/{owner}/{repo}/issues?state=open&per_page=100",
      "--jq",
      ".[] | select(.pull_request == null) | {number, title, labels: [.labels[].name]}",
    ]),
  ).map((line) => JSON.parse(line));
  const labels = lines(
    gh(exec, root, [
      "api",
      "--paginate",
      "repos/{owner}/{repo}/labels?per_page=100",
      "--jq",
      ".[].name",
    ]),
  );
  return { fixing: closingIssues(exec, root, env), issues, labels };
}

/**
 * The open work items: not exempt, and not fixed by the current pull
 * request (it closes them when it merges).
 */
function workItems({ fixing = [], issues }) {
  return issues.filter(
    (issue) =>
      !fixing.includes(issue.number) &&
      !issue.labels.some((label) => EXEMPT_LABELS.has(label)),
  );
}

/** An issue nobody has triaged yet: labelled triage, or with no UC/Q. */
const needsTriage = (issue) =>
  issue.labels.includes(TRIAGE) ||
  !issue.labels.some((label) => ID_LABEL.test(label));

/** The open issues that count towards an entry's status: triaged work items. */
function countedIssues(github) {
  return workItems(github).filter((issue) => !needsTriage(issue));
}

/** Open issue numbers per UC/Q label. */
export function openIssuesByEntry(github) {
  const byEntry = new Map();
  for (const issue of countedIssues(github)) {
    for (const label of issue.labels.filter((l) => ID_LABEL.test(l))) {
      if (!byEntry.has(label)) byEntry.set(label, []);
      byEntry.get(label).push(issue.number);
    }
  }
  return byEntry;
}

/**
 * Each entry with its generated status and the open issues behind it.
 * Not built is set in the register and stays, whatever is open. Otherwise
 * an entry is partial while a triaged open issue carries its label, and
 * supported when none does. Without GitHub (`github` null) the status is
 * unknown: null, with `openIssues` null.
 */
export function deriveStatuses(useCases, github) {
  const byEntry = github ? openIssuesByEntry(github) : null;
  return useCases.map((uc) => {
    const openIssues = byEntry
      ? [...(byEntry.get(uc.id) ?? [])].sort((a, b) => a - b)
      : null;
    let status = null;
    if (uc.notBuilt) status = NOT_BUILT;
    else if (openIssues)
      status = openIssues.length > 0 ? "partial" : "supported";
    return { ...uc, openIssues, status };
  });
}

/** Problems the check fails on whatever GitHub says, as messages. */
export function findProblems(useCases, scan) {
  const problems = [];
  const known = new Set(useCases.map((uc) => uc.id));
  for (const tag of scan.tags) {
    if (!known.has(tag.id)) {
      problems.push(
        `${tag.file}:${tag.line}: [${tag.id}] isn't in ${REGISTER} ("${tag.title}")`,
      );
    }
  }
  for (const uc of useCases) {
    if (uc.gap && aboveUnit(scan.index, uc.id)) {
      problems.push(
        `${uc.id} ${uc.name} now has a test above unit level: remove its **Test gap:** line from ${REGISTER}.`,
      );
    }
  }
  return problems;
}

/**
 * What a release can't ship with, from the register, GitHub and the tests:
 * each open issue is labelled with a use case or quality in the register,
 * each entry has a label, and each supported entry (no open issues) has a
 * test above unit level or declares the gap.
 *
 * `problems` are warnings on a pull request and failures for a release
 * (`--strict-issues`). `triage` lists the issues nobody has triaged yet;
 * they don't count towards a status and never fail the check, so an
 * outside issue can't block anyone.
 */
export function issueProblems(useCases, github, scan = null) {
  const problems = [];
  const triage = [];
  const known = new Set(useCases.map((uc) => uc.id));
  for (const issue of workItems(github).filter(needsTriage)) {
    triage.push(
      `#${issue.number} ("${issue.title}") needs triage: give it the UC-NN or Q-NN where a user would notice it, ` +
        `a kind and a severity, and remove ${TRIAGE}.`,
    );
  }
  for (const issue of countedIssues(github)) {
    for (const id of issue.labels.filter(
      (l) => ID_LABEL.test(l) && !known.has(l),
    )) {
      problems.push(
        `#${issue.number} is labelled ${id}, which isn't in ${REGISTER}.`,
      );
    }
  }
  const labels = new Set(github.labels);
  for (const uc of deriveStatuses(useCases, github)) {
    if (!labels.has(uc.id)) {
      problems.push(
        `${uc.id} has no label on GitHub: gh label create ${uc.id} --description "${uc.name}"`,
      );
    }
    if (
      scan &&
      uc.status === "supported" &&
      !uc.gap &&
      !aboveUnit(scan.index, uc.id)
    ) {
      problems.push(
        `${uc.id} ${uc.name} is supported (no open issues) but has no integration, e2e or validation test. ` +
          `Tag one with [${uc.id}], declare the gap with a **Test gap:** line in ${REGISTER}, ` +
          `or open a test issue labelled ${uc.id}.`,
      );
    }
  }
  return { problems, triage };
}

/** The issue checks as Markdown, for the CI job summary. */
export function renderIssueChecks({ problems, triage }, { strict }) {
  const out = ["", "## Issue checks", ""];
  out.push(
    strict
      ? "Release mode (`--strict-issues`): each of these fails the check."
      : "Pull request mode: these are warnings; the release check fails on them.",
    "",
  );
  if (problems.length === 0 && triage.length === 0) {
    out.push(
      "Every open issue traces to the register, every entry has its label, and every supported entry has a test above unit level or declares the gap.",
    );
  }
  if (problems.length > 0) {
    out.push(
      `### ${strict ? "Failures" : "Warnings"} (${problems.length})`,
      "",
    );
    for (const p of problems) out.push(`- ${p}`);
    out.push("");
  }
  if (triage.length > 0) {
    out.push(`### Needs triage (${triage.length})`, "");
    for (const t of triage) out.push(`- ${t}`);
  }
  return `${out.join("\n")}\n`;
}

/**
 * Per use case and quality, for the website's testing page: generated
 * status, tagged tests per layer, the declared test gap, and the number of
 * open issues labelled with it (status and count are null when GitHub
 * couldn't be read).
 */
export function summarise(useCases, scan, github = null) {
  return deriveStatuses(useCases, github).map((uc) => ({
    gap: uc.gap,
    group: uc.group,
    id: uc.id,
    kind: uc.kind,
    name: uc.name,
    openIssues: uc.openIssues ? uc.openIssues.length : null,
    status: uc.status,
    tests: Object.fromEntries(
      LAYERS.map((layer) => [layer, countIn(scan.index, uc.id, layer)]),
    ),
  }));
}

/** The open issues labelled with an entry's ID, on GitHub. */
export const issuesLink = (id) => `${ISSUES_URL}?q=is%3Aopen+label%3A${id}`;

const statusName = (status) => status ?? "unknown";

/** Entries per status, in STATUSES order, then unknown. */
function byStatus(entries) {
  return [...STATUSES, null]
    .map((status) => ({
      entries: entries.filter((uc) => uc.status === status),
      status,
    }))
    .filter(({ entries: list }) => list.length > 0);
}

/**
 * The generated statuses as console lines (`npm run trace`): one line per
 * status, partial entries with their open issues.
 */
export function statusLines(entries) {
  const out = [
    "Status, generated from the open issues (supported: none open; partial: at least one; not built: set in the register):",
  ];
  for (const { entries: list, status } of byStatus(entries)) {
    const ids = list.map((uc) =>
      status === "partial"
        ? `${uc.id} (${uc.openIssues.map((n) => `#${n}`).join(", ")})`
        : uc.id,
    );
    const note = status === null ? " (can't read GitHub)" : "";
    out.push(
      `  ${statusName(status)} (${list.length})${note}: ${ids.join(", ")}`,
    );
  }
  return out;
}

function cell(index, id, layer) {
  const n = countIn(index, id, layer);
  return n === 0 ? "-" : `[${n}](#${id.toLowerCase()})`;
}

/** An entry's status for the matrix, linking its open issues. */
function statusCell(uc) {
  const open = uc.openIssues?.length ?? 0;
  return open === 0
    ? statusName(uc.status)
    : `${uc.status} ([${open} open](${issuesLink(uc.id)}))`;
}

/**
 * The matrix as Markdown, deterministic: no dates, sorted throughout.
 * `useCases` carry their generated status (`deriveStatuses`). `base`
 * prefixes repository paths in links: relative to docs/developer by
 * default, or a blob URL for the CI summary.
 */
export function render(useCases, scan, { base = "../../" } = {}) {
  const { index } = scan;
  const out = [];
  const push = (...lines) => out.push(...lines);
  const register = base === "../../" ? "use-cases.md" : `${base}${REGISTER}`;
  const ucLink = (uc) =>
    `[${uc.id}](${register}#${slug(`${uc.id} ${uc.name}`)}) ${uc.name}`;
  const counts = byStatus(useCases)
    .map(({ entries, status }) => `${entries.length} ${statusName(status)}`)
    .join(", ");

  push(
    "<!-- Generated by `npm run trace` (scripts/traceability.mjs). Don't edit by hand. -->",
    "",
    "# Use case traceability",
    "",
    `Which tests cover each use case in [\`use-cases.md\`](${register}), by`,
    "layer, and each one's status. A test covers a use case when its title, or",
    "the title of a `describe` around it, carries the tag (`[UC-14]`). Counts",
    "are tests.",
    "",
    "Generated by `npm run trace` and not committed. CI runs",
    "`npm run trace:check`, which fails on an unknown ID or a closed test gap,",
    "and warns on what a release can't ship with: an issue or entry without",
    "its label, or a supported use case with no test above unit level that",
    "doesn't declare the gap (the release fails on those).",
    "",
    `${useCases.length} use cases: ${counts}. ` +
      `${scan.tagged} of ${scan.total} tests carry a use case tag.`,
    "",
    "## Status",
    "",
    "Generated from the open GitHub issues labelled with each entry's ID,",
    "leaving out issues that need triage: supported has none open, partial has",
    "at least one. Not built is set in the register. On a pull request, the",
    "issues it fixes count as closed. Each ID links to its open issues.",
    "",
    "| Status | Entries |",
    "|---|---|",
  );
  for (const { entries, status } of byStatus(useCases)) {
    const ids = entries.map((uc) => `[${uc.id}](${issuesLink(uc.id)})`);
    push(`| ${statusName(status)} (${entries.length}) | ${ids.join(", ")} |`);
  }
  push(
    "",
    "## Matrix",
    "",
    `| Use case | Status | ${LAYERS.map((l) => LAYER_LABELS[l]).join(" | ")} |`,
    `|---|---|${LAYERS.map(() => "--:").join("|")}|`,
  );
  for (const uc of useCases) {
    const cells = LAYERS.map((layer) => cell(index, uc.id, layer));
    push(`| ${ucLink(uc)} | ${statusCell(uc)} | ${cells.join(" | ")} |`);
  }

  const gaps = useCases.filter(
    (uc) => uc.status === "supported" && !aboveUnit(index, uc.id),
  );
  const validationOnly = useCases.filter(
    (uc) =>
      uc.status === "supported" &&
      countIn(index, uc.id, "validation") > 0 &&
      countIn(index, uc.id, "integration") === 0 &&
      countIn(index, uc.id, "e2e") === 0,
  );
  push("", "## Gaps", "");
  push(
    "Supported use cases with no test above unit level (declared in the register):",
    "",
  );
  if (gaps.length === 0) push("- none");
  for (const uc of gaps) push(`- ${ucLink(uc)}: ${uc.gap ?? "undeclared"}`);
  push(
    "",
    "Supported use cases covered above unit level only by the on-demand",
    "full-pipeline validation (`npm run validate:full`), which doesn't run on PRs:",
    "",
  );
  if (validationOnly.length === 0) push("- none");
  for (const uc of validationOnly) push(`- ${ucLink(uc)}`);
  const otherGaps = useCases.filter(
    (uc) => uc.status !== "supported" && !aboveUnit(index, uc.id),
  );
  push(
    "",
    "Partial, not-built or unknown use cases with no test above unit level:",
    "",
  );
  if (otherGaps.length === 0) push("- none");
  for (const uc of otherGaps) {
    push(`- ${ucLink(uc)} (${statusName(uc.status)})`);
  }

  push("", "## Tests by use case");
  for (const uc of useCases) {
    push(
      "",
      `### ${uc.id}`,
      "",
      `${ucLink(uc)} (${statusName(uc.status)})`,
      "",
    );
    const byLayer = index.get(uc.id);
    let any = false;
    for (const layer of LAYERS) {
      const byFile = byLayer?.get(layer);
      if (!byFile) continue;
      for (const file of [...byFile.keys()].sort()) {
        const { count, line } = byFile.get(file);
        const tests = count === 1 ? "1 test" : `${count} tests`;
        push(
          `- ${LAYER_LABELS[layer]}: [\`${file}\`](${base}${file}#L${line}) (${tests})`,
        );
        any = true;
      }
    }
    if (!any) push("- No tagged tests.");
  }
  return `${out.join("\n")}\n`;
}

export function run({
  check = false,
  env = process.env,
  strictIssues = false,
  github: readIssues = () => readGitHub({ env, root }),
  json,
  root = ROOT,
  log = console,
  summaryFile = env.GITHUB_STEP_SUMMARY,
} = {}) {
  const registerPath = path.join(root, REGISTER);
  const { errors, useCases } = parseRegister(
    fs.readFileSync(registerPath, "utf8"),
  );
  if (errors.length > 0) {
    for (const e of errors) log.error(e);
    return 1;
  }
  const files = findTestFiles(root);
  const scan = buildIndex(files, (f) =>
    fs.readFileSync(path.join(root, f), "utf8"),
  );
  const totals = `${useCases.length} use cases and qualities, ${scan.tagged} of ${scan.total} tests tagged.`;

  // Statuses come from the issues, so every mode reads them
  let github = null;
  try {
    github = readIssues();
  } catch (error) {
    const reason = String(error.stderr || error.message)
      .trim()
      .split("\n")[0];
    if (check && strictIssues) {
      log.error(
        `Traceability check failed: --strict-issues needs the GitHub issues, and gh can't read them (${reason}). The job needs GH_TOKEN and issues: read.`,
      );
      return 1;
    }
    log.log(
      `${env.GITHUB_ACTIONS === "true" ? "::warning title=Traceability::" : ""}Skipping the issue checks and showing statuses as unknown: can't read GitHub issues with gh (${reason}).`,
    );
  }
  if (github?.fixing?.length > 0) {
    log.log(
      `Counting ${github.fixing.map((n) => `#${n}`).join(", ")} as closed: this pull request fixes ${github.fixing.length === 1 ? "it" : "them"}.`,
    );
  }
  const entries = deriveStatuses(useCases, github);
  for (const line of statusLines(entries)) log.log(line);

  if (json) {
    fs.writeFileSync(
      json,
      `${JSON.stringify(summarise(useCases, scan, github), null, 2)}\n`,
    );
  }

  if (!check) {
    fs.writeFileSync(path.join(root, OUTPUT), render(entries, scan));
    log.log(`Wrote ${OUTPUT}: ${totals}`);
    return 0;
  }

  if (summaryFile) {
    const { GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_SHA } = process.env;
    const base =
      GITHUB_REPOSITORY && GITHUB_SHA
        ? `${GITHUB_SERVER_URL ?? "https://github.com"}/${GITHUB_REPOSITORY}/blob/${GITHUB_SHA}/`
        : "../../";
    fs.appendFileSync(summaryFile, render(entries, scan, { base }));
  }
  const problems = findProblems(useCases, scan);
  const issues = github
    ? issueProblems(useCases, github, scan)
    : { problems: [], triage: [] };
  if (github && summaryFile) {
    fs.appendFileSync(
      summaryFile,
      renderIssueChecks(issues, { strict: strictIssues }),
    );
  }
  const inActions = env.GITHUB_ACTIONS === "true";
  const annotate = (level, title, message) =>
    log.log(
      inActions
        ? `::${level} title=${title}::${message}`
        : `${level}: ${message}`,
    );
  for (const t of issues.triage) annotate("notice", "Needs triage", t);
  if (strictIssues) {
    problems.push(...issues.problems);
  } else {
    for (const p of issues.problems) {
      annotate("warning", "Release blocker", p);
    }
  }
  if (problems.length > 0) {
    log.error(`Traceability check failed (${problems.length}):`);
    for (const p of problems) log.error(`- ${p}`);
    return 1;
  }
  const warned =
    !strictIssues && issues.problems.length > 0
      ? ` ${issues.problems.length} issue warning(s); the release check fails on them.`
      : "";
  log.log(`Traceability OK: ${totals}${warned}`);
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf("--json");
  const json = jsonAt === -1 ? undefined : args[jsonAt + 1];
  const unknown = args.filter(
    (a, i) =>
      a !== "--check" &&
      a !== "--strict-issues" &&
      !(jsonAt !== -1 && (i === jsonAt || i === jsonAt + 1)),
  );
  if (unknown.length > 0 || (jsonAt !== -1 && !json)) {
    console.error(
      `Unknown option ${unknown[0] ?? "--json"}. Options: --check, --strict-issues, --json <file>`,
    );
    process.exit(2);
  }
  process.exit(
    run({
      check: args.includes("--check"),
      json,
      strictIssues: args.includes("--strict-issues"),
    }),
  );
}

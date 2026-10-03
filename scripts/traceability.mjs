#!/usr/bin/env node
/**
 * Use case traceability (RE-67).
 *
 *   npm run trace         # write docs/developer/traceability.md (not committed)
 *   npm run trace:check   # fail on unknown IDs or untested use cases; warn
 *                         # when the register and the issues disagree
 *   ... --strict-issues   # fail on those disagreements too (the release)
 *   ... --json <file>     # also write the per-entry summary (testing page)
 *
 * Reads the use case register (docs/developer/use-cases.md) and the
 * `[UC-NN]` tags in test titles, and writes a use case x test layer matrix.
 * A tag on a `describe` covers every test inside it.
 *
 * The backlog is GitHub issues, each labelled with the use case or quality
 * (`UC-NN`, `Q-NN`) where a user would notice it. The labels are the trace.
 *
 * The check fails when:
 * - a test names a use case the register doesn't have;
 * - a supported use case has no test above unit level and the register
 *   doesn't declare the gap (a `**Test gap:**` line);
 * - a declared gap is closed (the line must go).
 *
 * The issue checks compare the register with GitHub: an open issue with a
 * UC/Q label the register lacks, an entry with no label on GitHub, and an
 * entry whose status disagrees with its open issues (supported with an open
 * issue, or partial with none). On a pull request they're warnings
 * (`::warning::` annotations and the job summary), because anyone can open
 * an issue and that mustn't turn every PR red. With `--strict-issues`, as
 * the release runs it, they fail: a release can't ship while the register
 * disagrees with the issues. Issues the current pull request fixes
 * (`Fixes #N`) count as closed, so a fix PR's status change shows clean.
 *
 * An issue labelled `triage`, or with no UC/Q label, needs triage: it's
 * listed as a notice, never fails, and doesn't count towards a status.
 *
 * Issues are read with `gh`. Without it (offline, or not signed in), the
 * issue checks are skipped with a notice; `--strict-issues` fails instead.
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
const STATUSES = ["supported", "partial", "not built"];

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
 * (qualities) headings, each with a `**Status:**` line, under `## Group`
 * headings. Collects each entry's declared test gap.
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
        status: null,
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
      const value = STATUSES.find((s) => status[1].toLowerCase().startsWith(s));
      if (value) current.status = value;
      else errors.push(`${current.id}: unknown status "${status[1]}"`);
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
    if (!uc.status) errors.push(`${uc.id} has no **Status:** line`);
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

/** Problems the check fails on, as messages. */
export function findProblems(useCases, scan, github) {
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
    if (uc.status !== "supported") continue;
    const covered = aboveUnit(scan.index, uc.id);
    if (!covered && !uc.gap) {
      problems.push(
        `${uc.id} ${uc.name} is supported but has no integration, e2e or validation test. ` +
          `Tag one with [${uc.id}], or declare the gap with a **Test gap:** line in ${REGISTER}.`,
      );
    }
    if (covered && uc.gap) {
      problems.push(
        `${uc.id} ${uc.name} now has a test above unit level: remove its **Test gap:** line from ${REGISTER}.`,
      );
    }
  }
  return problems;
}

/**
 * Everything traces from a user-oriented statement: each open issue is
 * labelled with a use case or quality in the register, each entry has a
 * label, and an entry's status follows its open issues.
 *
 * `problems` are disagreements between the register and GitHub: warnings on
 * a pull request, failures for a release (`--strict-issues`). `triage` lists
 * the issues nobody has triaged yet; they don't count towards a status and
 * never fail the check, so an outside issue can't block anyone.
 */
export function issueProblems(useCases, github) {
  const problems = [];
  const triage = [];
  const known = new Set(useCases.map((uc) => uc.id));
  for (const issue of workItems(github).filter(needsTriage)) {
    triage.push(
      `#${issue.number} ("${issue.title}") needs triage: give it the UC-NN or Q-NN where a user would notice it, ` +
        `a kind and a severity, remove ${TRIAGE}, and update the entry's status in ${REGISTER}.`,
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
  const byEntry = openIssuesByEntry(github);
  for (const uc of useCases) {
    if (!labels.has(uc.id)) {
      problems.push(
        `${uc.id} has no label on GitHub: gh label create ${uc.id} --description "${uc.name}"`,
      );
    }
    const open = byEntry.get(uc.id) ?? [];
    if (uc.status === "supported" && open.length > 0) {
      problems.push(
        `${uc.id} ${uc.name} is supported but has open issues (${open.map((n) => `#${n}`).join(", ")}): ` +
          `mark it partial in ${REGISTER}, or close them.`,
      );
    }
    if (uc.status === "partial" && open.length === 0) {
      problems.push(
        `${uc.id} ${uc.name} is partial but no open issue is labelled ${uc.id}: ` +
          `open one for what's missing, or mark it supported in ${REGISTER}.`,
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
      ? "Release mode (`--strict-issues`): a disagreement fails the check."
      : "Pull request mode: disagreements are warnings; the release check fails on them.",
    "",
  );
  if (problems.length === 0 && triage.length === 0) {
    out.push(
      "Every open issue traces to the register, and every status matches its issues.",
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
 * Per use case and quality, for the website's testing page: status, tagged
 * tests per layer, the declared test gap, and the number of open issues
 * labelled with it (null when GitHub couldn't be read).
 */
export function summarise(useCases, scan, github = null) {
  const byEntry = github ? openIssuesByEntry(github) : null;
  return useCases.map((uc) => ({
    gap: uc.gap,
    group: uc.group,
    id: uc.id,
    kind: uc.kind,
    name: uc.name,
    openIssues: byEntry ? (byEntry.get(uc.id)?.length ?? 0) : null,
    status: uc.status,
    tests: Object.fromEntries(
      LAYERS.map((layer) => [layer, countIn(scan.index, uc.id, layer)]),
    ),
  }));
}

function cell(index, id, layer) {
  const n = countIn(index, id, layer);
  return n === 0 ? "-" : `[${n}](#${id.toLowerCase()})`;
}

/** The generated markdown. Deterministic: no dates, sorted throughout. */
/**
 * The matrix as Markdown. `base` prefixes repository paths in links:
 * relative to docs/developer by default, or a blob URL for the CI summary.
 */
export function render(useCases, scan, { base = "../../" } = {}) {
  const { index } = scan;
  const out = [];
  const push = (...lines) => out.push(...lines);
  const register = base === "../../" ? "use-cases.md" : `${base}${REGISTER}`;
  const ucLink = (uc) =>
    `[${uc.id}](${register}#${slug(`${uc.id} ${uc.name}`)}) ${uc.name}`;
  const statusCount = (s) => useCases.filter((uc) => uc.status === s).length;

  push(
    "<!-- Generated by `npm run trace` (scripts/traceability.mjs). Don't edit by hand. -->",
    "",
    "# Use case traceability",
    "",
    `Which tests cover each use case in [\`use-cases.md\`](${register}), by`,
    "layer. A test covers a use case when its title, or the title of a",
    "`describe` around it, carries the tag (`[UC-14]`). Counts are tests.",
    "",
    "Generated by `npm run trace` and not committed. CI runs",
    "`npm run trace:check`, which fails on an unknown ID or on a supported use",
    "case with no test above unit level (unless the register declares the gap),",
    "and warns when an entry's status doesn't match its open GitHub issues",
    "(the release fails on that).",
    "",
    `${useCases.length} use cases: ${statusCount("supported")} supported, ` +
      `${statusCount("partial")} partial, ${statusCount("not built")} not built. ` +
      `${scan.tagged} of ${scan.total} tests carry a use case tag.`,
    "",
    "## Matrix",
    "",
    `| Use case | Status | ${LAYERS.map((l) => LAYER_LABELS[l]).join(" | ")} |`,
    `|---|---|${LAYERS.map(() => "--:").join("|")}|`,
  );
  for (const uc of useCases) {
    const cells = LAYERS.map((layer) => cell(index, uc.id, layer));
    push(`| ${ucLink(uc)} | ${uc.status} | ${cells.join(" | ")} |`);
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
  push("", "Partial or not-built use cases with no test above unit level:", "");
  if (otherGaps.length === 0) push("- none");
  for (const uc of otherGaps) push(`- ${ucLink(uc)} (${uc.status})`);

  push("", "## Tests by use case");
  for (const uc of useCases) {
    push("", `### ${uc.id}`, "", `${ucLink(uc)} (${uc.status})`, "");
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

  let github = null;
  if (check || json) {
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
        `${env.GITHUB_ACTIONS === "true" ? "::warning title=Traceability::" : ""}Skipping the issue checks: can't read GitHub issues with gh (${reason}).`,
      );
    }
  }
  if (github?.fixing?.length > 0) {
    log.log(
      `Counting ${github.fixing.map((n) => `#${n}`).join(", ")} as closed: this pull request fixes ${github.fixing.length === 1 ? "it" : "them"}.`,
    );
  }

  if (json) {
    fs.writeFileSync(
      json,
      `${JSON.stringify(summarise(useCases, scan, github), null, 2)}\n`,
    );
  }

  if (!check) {
    fs.writeFileSync(path.join(root, OUTPUT), render(useCases, scan));
    log.log(`Wrote ${OUTPUT}: ${totals}`);
    return 0;
  }

  if (summaryFile) {
    const { GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_SHA } = process.env;
    const base =
      GITHUB_REPOSITORY && GITHUB_SHA
        ? `${GITHUB_SERVER_URL ?? "https://github.com"}/${GITHUB_REPOSITORY}/blob/${GITHUB_SHA}/`
        : "../../";
    fs.appendFileSync(summaryFile, render(useCases, scan, { base }));
  }
  const problems = findProblems(useCases, scan);
  const issues = github
    ? issueProblems(useCases, github)
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
      annotate("warning", "Register and issues disagree", p);
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

#!/usr/bin/env node
/**
 * Use case traceability (RE-67).
 *
 *   npm run trace         # write docs/developer/traceability.md (not committed)
 *   npm run trace:check   # fail on unknown IDs, untested use cases, or a
 *                         # backlog that doesn't trace (see below)
 *   ... --json <file>     # also write the per-entry summary (testing page)
 *
 * Reads the use case register (docs/developer/use-cases.md) and the
 * `[UC-NN]` tags in test titles, and writes a use case x test layer matrix.
 * A tag on a `describe` covers every test inside it.
 *
 * The check fails when:
 * - a test names a use case the register doesn't have;
 * - a supported use case has no test above unit level and the register
 *   doesn't declare the gap (a `**Test gap:**` line);
 * - a declared gap is closed (the line must go);
 * - an open BACKLOG.md item isn't a known issue of any use case or quality,
 *   an entry lists an item that's done or unknown, or a one-liner has code
 *   in it: everything traces from a user-oriented statement.
 *
 * The matrix is generated, never committed: its counts change with every
 * new test, and a committed copy went stale on almost every PR. In CI the
 * check also writes it to the job summary (GITHUB_STEP_SUMMARY), with links
 * to the commit it ran on.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = "docs/developer/use-cases.md";
const BACKLOG = "BACKLOG.md";
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
 * headings. Collects each entry's declared test gap and the backlog IDs on
 * its `**Known issues:**` line.
 */
export function parseRegister(markdown) {
  const useCases = [];
  const errors = [];
  let current = null;
  let group = null;
  let inGap = false;
  let inIssues = false;
  for (const line of markdown.split("\n")) {
    const heading = /^### ((UC|Q)-\d{2}) (.+?)\s*$/.exec(line);
    if (heading) {
      current = {
        gap: null,
        group,
        id: heading[1],
        issues: [],
        kind: heading[2] === "Q" ? "quality" : "use case",
        name: heading[3],
        status: null,
      };
      useCases.push(current);
      inGap = false;
      inIssues = false;
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
    // So does the known issues line; it names backlog items by ID.
    const issues = /^- \*\*Known issues:\*\*(.*)$/.exec(line);
    if (issues || (inIssues && line.trim() && !/^(\*\*|- |#)/.test(line))) {
      for (const m of (issues ? issues[1] : line).matchAll(
        /\b((?:RE|OPS)-\d+)\b/g,
      )) {
        if (!current.issues.includes(m[1])) current.issues.push(m[1]);
      }
      inIssues = true;
      continue;
    }
    inIssues = false;
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

/**
 * Parse BACKLOG.md's tables: `| ID | Severity | Area | Item | Status |`, and
 * the owner table's `| ID | Item | Status |`. An item is done when it sits
 * under `## Done` or its status starts with "done".
 */
export function parseBacklog(markdown) {
  const items = new Map();
  let section = "";
  for (const line of markdown.split("\n")) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading) section = heading[1];
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5 || !/^(RE|OPS)-\d+$/.test(cells[1])) continue;
    const [item, status] =
      cells.length >= 7 ? [cells[4], cells[5]] : [cells[2], cells[3]];
    items.set(cells[1], {
      done: section === "Done" || /^done\b/i.test(status),
      id: cells[1],
      item,
      status,
    });
  }
  return items;
}

/** Problems the check fails on, as messages. */
export function findProblems(useCases, scan, backlog) {
  const problems = [];
  if (backlog) problems.push(...backlogProblems(useCases, backlog));
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
 * Everything traces from a user-oriented statement: each open backlog item
 * is a known issue of a use case or quality, entries list no finished or
 * unknown items, and one-liners are plain language.
 */
function backlogProblems(useCases, backlog) {
  const problems = [];
  const listed = new Set();
  for (const uc of useCases) {
    for (const id of uc.issues) {
      listed.add(id);
      const item = backlog.get(id);
      if (!item) {
        problems.push(`${uc.id} lists ${id}, which isn't in BACKLOG.md.`);
      } else if (item.done) {
        problems.push(
          `${uc.id} lists ${id}, which BACKLOG.md marks done: remove it from ${uc.id}'s **Known issues:**.`,
        );
      }
    }
  }
  for (const item of backlog.values()) {
    if (!item.done && !listed.has(item.id)) {
      problems.push(
        `${item.id} is open in BACKLOG.md but no use case or quality lists it: add it to one's **Known issues:** in ${REGISTER}.`,
      );
    }
    if (item.item.includes("`")) {
      problems.push(
        `${item.id}: write its BACKLOG.md one-liner in plain language, without code (details belong in the findings register).`,
      );
    }
  }
  return problems;
}

/**
 * Per use case and quality, for the website's testing page: status, tagged
 * tests per layer, the declared test gap, and open backlog items with their
 * one-liners.
 */
export function summarise(useCases, scan, backlog = new Map()) {
  return useCases.map((uc) => ({
    gap: uc.gap,
    group: uc.group,
    id: uc.id,
    issues: uc.issues
      .map((id) => backlog.get(id))
      .filter((item) => item && !item.done)
      .map(({ id, item }) => ({ id, text: item })),
    kind: uc.kind,
    name: uc.name,
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
    "case with no test above unit level (unless the register declares the gap).",
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
  json,
  root = ROOT,
  log = console,
  summaryFile = process.env.GITHUB_STEP_SUMMARY,
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
  const backlogPath = path.join(root, BACKLOG);
  const backlog = fs.existsSync(backlogPath)
    ? parseBacklog(fs.readFileSync(backlogPath, "utf8"))
    : undefined;
  const totals = `${useCases.length} use cases and qualities, ${scan.tagged} of ${scan.total} tests tagged.`;

  if (json) {
    fs.writeFileSync(
      json,
      `${JSON.stringify(summarise(useCases, scan, backlog), null, 2)}\n`,
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
  const problems = findProblems(useCases, scan, backlog);
  if (problems.length > 0) {
    log.error(`Traceability check failed (${problems.length}):`);
    for (const p of problems) log.error(`- ${p}`);
    return 1;
  }
  log.log(`Traceability OK: ${totals}`);
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
      a !== "--check" && !(jsonAt !== -1 && (i === jsonAt || i === jsonAt + 1)),
  );
  if (unknown.length > 0 || (jsonAt !== -1 && !json)) {
    console.error(
      `Unknown option ${unknown[0] ?? "--json"}. Options: --check, --json <file>`,
    );
    process.exit(2);
  }
  process.exit(run({ check: args.includes("--check"), json }));
}

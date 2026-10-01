#!/usr/bin/env node
/**
 * Use case traceability (RE-67).
 *
 *   npm run trace         # regenerate docs/developer/traceability.md
 *   npm run trace:check   # fail on unknown IDs, untested use cases or a stale file
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
 * - the committed traceability.md differs from what this script writes.
 */
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

/** Parse the register: `### UC-NN Name` headings with a `**Status:**` line. */
export function parseRegister(markdown) {
  const useCases = [];
  const errors = [];
  let current = null;
  let inGap = false;
  for (const line of markdown.split("\n")) {
    const heading = /^### (UC-\d{2}) (.+?)\s*$/.exec(line);
    if (heading) {
      current = { gap: null, id: heading[1], name: heading[2], status: null };
      useCases.push(current);
      inGap = false;
      continue;
    }
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
        const own = [...title.matchAll(/\[(UC-\d+)\]/g)].map((m) => m[1]);
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

/** Problems the check fails on, as messages. */
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

function cell(index, id, layer) {
  const n = countIn(index, id, layer);
  return n === 0 ? "-" : `[${n}](#${id.toLowerCase()})`;
}

/** The generated markdown. Deterministic: no dates, sorted throughout. */
export function render(useCases, scan) {
  const { index } = scan;
  const out = [];
  const push = (...lines) => out.push(...lines);
  const ucLink = (uc) =>
    `[${uc.id}](use-cases.md#${slug(`${uc.id} ${uc.name}`)}) ${uc.name}`;
  const statusCount = (s) => useCases.filter((uc) => uc.status === s).length;

  push(
    "<!-- Generated by `npm run trace` (scripts/traceability.mjs). Don't edit by hand. -->",
    "",
    "# Use case traceability",
    "",
    "Which tests cover each use case in [`use-cases.md`](use-cases.md), by",
    "layer. A test covers a use case when its title, or the title of a",
    "`describe` around it, carries the tag (`[UC-14]`). Counts are tests.",
    "",
    "Regenerate with `npm run trace`; CI runs `npm run trace:check`, which",
    "fails on an unknown ID, on a supported use case with no test above unit",
    "level (unless the register declares the gap), and when this file is stale.",
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
  push(
    "",
    "Partial or not-built use cases with no test above unit level:",
    "",
  );
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
          `- ${LAYER_LABELS[layer]}: [\`${file}\`](../../${file}#L${line}) (${tests})`,
        );
        any = true;
      }
    }
    if (!any) push("- No tagged tests.");
  }
  return `${out.join("\n")}\n`;
}

export function run({ check = false, root = ROOT, log = console } = {}) {
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
  const markdown = render(useCases, scan);
  const outputPath = path.join(root, OUTPUT);

  if (!check) {
    fs.writeFileSync(outputPath, markdown);
    log.log(
      `Wrote ${OUTPUT}: ${useCases.length} use cases, ${scan.tagged} of ${scan.total} tests tagged.`,
    );
    return 0;
  }

  const problems = findProblems(useCases, scan);
  const current = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : "";
  if (current !== markdown) {
    problems.push(`${OUTPUT} is stale: run \`npm run trace\` and commit it.`);
  }
  if (problems.length > 0) {
    log.error(`Traceability check failed (${problems.length}):`);
    for (const p of problems) log.error(`- ${p}`);
    return 1;
  }
  log.log(
    `Traceability OK: ${useCases.length} use cases, ${scan.tagged} of ${scan.total} tests tagged.`,
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => a !== "--check");
  if (unknown.length > 0) {
    console.error(`Unknown option ${unknown[0]}. Options: --check`);
    process.exit(2);
  }
  process.exit(run({ check: args.includes("--check") }));
}

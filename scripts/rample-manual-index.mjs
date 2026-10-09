#!/usr/bin/env node
/**
 * Rample manual index (#538, Q-08).
 *
 *   npm run rample-manual                   # fetch the manual, update the index
 *   npm run rample-manual -- --html <file>  # parse a saved copy instead
 *   npm run rample-manual -- --dry-run      # report only; write nothing
 *   npm run rample-manual -- --force        # write even if most sections vanished
 *
 * Run by hand when Squarp publishes a new Rample manual or firmware (the
 * `rample-manual-map` skill). It fetches https://squarp.net/rample/manual/,
 * splits it into sections and writes docs/developer/rample-manual-index.md:
 * one row per section, keyed by its heading text, with the box's generated
 * div id as its anchor and a hash of its text. A section's sub-headings
 * (a bold upper-case line, like SLICER under Settings) get rows of their
 * own, keyed `Section › SUB-HEADING`.
 *
 * The Relationship, Use cases and Notes columns are kept by hand. A run
 * keeps them, by heading, or by anchor or text hash when a heading was
 * renamed, and regenerates every other column. The Concepts column joins
 * each section to the concepts in docs/developer/domain-model.md that cite
 * its anchor.
 *
 * The manual is Squarp's: the index holds only headings, anchors, hashes
 * and our own notes, never its text. The fetched page and each section's
 * text go to .cache/rample-manual/ (ignored by git), with the previous
 * run's text in previous/, so `diff -ru` shows what changed.
 *
 * The report lists sections whose text changed since the last run, new,
 * renamed and removed sections, sections with no mapping yet, candidate
 * features (relationship `none`, no issue cited and not marked "not a gap"),
 * citations in docs/ of anchors the page no longer has, and problems
 * (an unknown relationship or use case ID). Problems exit 1.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MANUAL_URL = "https://squarp.net/rample/manual/";
const INDEX = "docs/developer/rample-manual-index.md";
const DOMAIN_MODEL = "docs/developer/domain-model.md";
const REGISTER = "docs/developer/use-cases.md";
const CACHE = ".cache/rample-manual";
/** The domain model's own table of sections, which isn't a concept */
const NOT_A_CONCEPT = new Set(["Rample manual coverage"]);
export const RELATIONSHIPS = ["writes", "mirrors", "documents", "none"];
const TABLE_HEADER = [
  "Section",
  "Anchor",
  "Text hash",
  "Changed",
  "Relationship",
  "Use cases",
  "Concepts",
  "Notes",
];

/**
 * @typedef {object} Section A heading of the manual and the text under it
 * @property {string} anchor the box's div id, without `#`
 * @property {string} hash short sha256 of `text`
 * @property {string} key the heading, or `Heading › SUB-HEADING`
 * @property {string | null} parent the box's heading, for a sub-heading
 * @property {string} text the section's plain text (never committed)
 *
 * @typedef {object} ParsedManual
 * @property {Section[]} sections in page order
 * @property {string | null} version a manual or firmware version, if the
 *   page states one
 *
 * @typedef {object} IndexRow A row of the committed index
 * @property {string} anchor
 * @property {string} changed the fetch date the hash last changed
 * @property {string} hash
 * @property {string} key
 * @property {string} notes kept by hand
 * @property {string} relationship kept by hand
 * @property {string} useCases kept by hand
 *
 * @typedef {object} ParsedIndex
 * @property {string | null} fetched the last run's fetch date
 * @property {IndexRow[]} rows
 *
 * @typedef {object} Merged The index after a run, and what changed
 * @property {{ key: string, hash: string, previousHash: string }[]} changed
 * @property {string[]} added
 * @property {IndexRow[]} removed
 * @property {{ from: string, to: string }[]} renamed
 * @property {IndexRow[]} rows
 */

const ENTITIES = /** @type {Record<string, string>} */ ({
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
});

/**
 * Decode the HTML entities a page uses; unknown named ones stay as they are
 * @param {string} text
 */
export function decodeEntities(text) {
  return text.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === "#") {
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Plain text of an HTML fragment, whitespace collapsed
 * @param {string} html
 */
export function textOf(html) {
  return decodeEntities(html.replaceAll(/<[^>]*>/g, " "))
    .normalize("NFC")
    .replaceAll(/\s+/g, " ")
    .trim();
}

/**
 * Short, stable hash of a section's text
 * @param {string} text
 */
export function hashText(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
}

/**
 * Drop what never carries manual text: scripts, styles, SVG and comments
 * @param {string} html
 */
function stripNoise(html) {
  return html
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, "");
}

/**
 * An attribute's value in an opening tag
 * @param {string} tag
 * @param {string} name
 */
function attribute(tag, name) {
  const match = new RegExp(String.raw`\s${name}="([^"]*)"`, "i").exec(tag);
  return match ? decodeEntities(match[1]) : null;
}

/**
 * Does the tag's class list have a class starting with `prefix`?
 * @param {string} tag
 * @param {string} prefix
 */
function hasClassPrefix(tag, prefix) {
  return (attribute(tag, "class") ?? "")
    .split(/\s+/)
    .some((c) => c.startsWith(prefix));
}

/**
 * Where each box starts and ends. A manual section is a `Box_large…` div
 * with an id; a group box (`id="Box_…"`) or the footer ends the one before.
 * @param {string} html
 * @returns {{ start: number, tag: string, section: boolean }[]}
 */
function boxBoundaries(html) {
  const bounds = [];
  for (const match of html.matchAll(/<div\b[^>]*>/gi)) {
    const tag = match[0];
    const id = attribute(tag, "id");
    const section = hasClassPrefix(tag, "Box_large") && Boolean(id);
    const group = Boolean(id && (/^Box_/.test(id) || /^FOOTER/i.test(id)));
    if (section || group) {
      bounds.push({ section, start: match.index, tag });
    }
  }
  return bounds;
}

/**
 * A sub-heading is a line of bold (`futuraBold`) upper-case words on its
 * own, like `SLICER` or `SP1, SP2, SP3, SP4`. Bold words inside a sentence
 * (`?X`) aren't.
 */
const SUB_HEADING =
  /(?:^|<br\s*\/?>|<p\b[^>]*>|<div\b[^>]*>)\s*((?:<span\b[^>]*\bfuturaBold\b[^>]*>[^<]*<\/span>\s*,?\s*)+)(?=<br|<\/p>|<\/div>)/gi;

/**
 * Split a box's body at its sub-headings
 * @param {string} body the box's HTML after its title
 * @returns {{ intro: string, subs: { heading: string, html: string }[] }}
 */
function splitSubHeadings(body) {
  /** @type {{ heading: string, start: number, end: number }[]} */
  const marks = [];
  for (const match of body.matchAll(SUB_HEADING)) {
    const heading = [...match[1].matchAll(/<span\b[^>]*>([^<]*)<\/span>/gi)]
      .map((m) => textOf(m[1]))
      .filter(Boolean)
      .join(", ");
    const letters = heading.replaceAll(/[^a-z]/gi, "");
    if (letters.length >= 3 && heading === heading.toUpperCase()) {
      marks.push({
        end: match.index + match[0].length,
        heading,
        start: match.index,
      });
    }
  }
  const intro = body.slice(0, marks[0]?.start ?? body.length);
  const subs = marks.map((mark, i) => ({
    heading: mark.heading,
    html: body.slice(mark.end, marks[i + 1]?.start ?? body.length),
  }));
  return { intro, subs };
}

/**
 * A key that isn't taken yet: `key`, then `key (2)`, …
 * @param {Set<string>} taken
 * @param {string} key
 */
function uniqueKey(taken, key) {
  let candidate = key;
  for (let n = 2; taken.has(candidate); n++) candidate = `${key} (${n})`;
  taken.add(candidate);
  return candidate;
}

/**
 * Split the manual page into sections
 * @param {string} html the page
 * @returns {ParsedManual}
 */
export function parseManual(html) {
  const page = stripNoise(html);
  const bounds = boxBoundaries(page);
  /** @type {Section[]} */
  const sections = [];
  const taken = new Set();
  bounds.forEach((bound, i) => {
    if (!bound.section) return;
    const box = page.slice(bound.start, bounds[i + 1]?.start ?? page.length);
    const title =
      /<(\w+)\b[^>]*\bclass="[^"]*\bmanual_box_title\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(
        box,
      );
    if (!title) return;
    const heading = textOf(title[2]);
    if (!heading) return;
    const anchor = /** @type {string} */ (attribute(bound.tag, "id"));
    const key = uniqueKey(taken, heading);
    const { intro, subs } = splitSubHeadings(
      box.slice(title.index + title[0].length),
    );
    const text = textOf(intro);
    sections.push({ anchor, hash: hashText(text), key, parent: null, text });
    for (const sub of subs) {
      const subText = textOf(sub.html);
      sections.push({
        anchor,
        hash: hashText(subText),
        key: uniqueKey(taken, `${heading} › ${sub.heading}`),
        parent: key,
        text: subText,
      });
    }
  });
  const version =
    /(?:\w*OS|\bfirmware|\bmanual)\s+v(?:ersion)?\s*(\d+(?:\.\d+)+)/i.exec(
      sections.map((s) => s.text).join(" "),
    )?.[1] ?? null;
  return { sections, version };
}

/**
 * Split a Markdown table row into its cells (`\|` is a literal pipe)
 * @param {string} line
 */
export function splitRow(line) {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

/**
 * A value as a table cell
 * @param {string} value
 */
function cell(value) {
  return value.replaceAll("|", String.raw`\|`).replaceAll("\n", " ");
}

/**
 * Read the committed index: its rows and the last fetch date
 * @param {string} markdown
 * @returns {ParsedIndex}
 */
export function parseIndex(markdown) {
  const fetched = /^\*\*Fetched:\*\*\s*(\S+)/m.exec(markdown)?.[1] ?? null;
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /^\|\s*Section\s*\|/.test(l));
  /** @type {IndexRow[]} */
  const rows = [];
  if (start === -1) return { fetched, rows };
  const header = splitRow(lines[start]);
  /** @param {string[]} cells @param {string} name */
  const column = (cells, name) =>
    (cells[header.indexOf(name)] ?? "").replaceAll(String.raw`\|`, "|");
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;
    const cells = splitRow(line);
    const key = column(cells, "Section");
    if (!key) continue;
    rows.push({
      anchor: column(cells, "Anchor").replace(/^\[#?([^\]]*)\].*$/, "$1"),
      changed: column(cells, "Changed"),
      hash: column(cells, "Text hash").replaceAll("`", ""),
      key,
      notes: column(cells, "Notes"),
      relationship: column(cells, "Relationship"),
      useCases: column(cells, "Use cases"),
    });
  }
  return { fetched, rows };
}

/**
 * Carry the hand-kept columns over to the new sections. A row is matched by
 * heading; failing that, by anchor (a renamed box) or by text hash (a
 * renamed sub-heading).
 * @param {IndexRow[]} previous the committed rows
 * @param {Section[]} sections this run's sections
 * @param {string} date this run's fetch date
 * @returns {Merged}
 */
export function mergeSections(previous, sections, date) {
  const byKey = new Map(previous.map((row) => [row.key, row]));
  const newKeys = new Set(sections.map((s) => s.key));
  const unmatched = previous.filter((row) => !newKeys.has(row.key));
  /** @type {Merged} */
  const merged = {
    added: [],
    changed: [],
    removed: [],
    renamed: [],
    rows: [],
  };
  for (const section of sections) {
    let old = byKey.get(section.key);
    if (!old) {
      const sameBox = (/** @type {IndexRow} */ row) =>
        section.parent === null
          ? row.anchor === section.anchor && !row.key.includes(" › ")
          : row.hash === section.hash && row.key.includes(" › ");
      const at = unmatched.findIndex(
        (row) =>
          sameBox(row) || (section.text !== "" && row.hash === section.hash),
      );
      if (at !== -1) {
        old = unmatched.splice(at, 1)[0];
        merged.renamed.push({ from: old.key, to: section.key });
      }
    }
    if (!old) merged.added.push(section.key);
    else if (old.hash !== section.hash) {
      merged.changed.push({
        hash: section.hash,
        key: section.key,
        previousHash: old.hash,
      });
    }
    merged.rows.push({
      anchor: section.anchor,
      changed:
        old && old.hash === section.hash && old.changed ? old.changed : date,
      hash: section.hash,
      key: section.key,
      notes: old?.notes ?? "",
      relationship: old?.relationship ?? "",
      useCases: old?.useCases ?? "",
    });
  }
  merged.removed = unmatched;
  return merged;
}

/**
 * GitHub's anchor for a heading
 * @param {string} heading
 */
export function headingSlug(heading) {
  return heading
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replaceAll(/\s/g, "-");
}

/**
 * Which `##`/`###` headings of a doc cite each manual anchor
 * @param {string} markdown
 * @returns {Map<string, string[]>} anchor → headings, in doc order
 */
export function citationsByAnchor(markdown) {
  /** @type {Map<string, string[]>} */
  const cited = new Map();
  let heading = null;
  for (const line of markdown.split("\n")) {
    const h = /^#{2,3}\s+(.+?)\s*$/.exec(line);
    if (h) {
      heading = h[1];
      continue;
    }
    if (!heading || NOT_A_CONCEPT.has(heading)) continue;
    for (const m of line.matchAll(
      /squarp\.net\/rample\/manual\/#([^)\s"'<>`]+)/g,
    )) {
      const list = cited.get(m[1]) ?? [];
      if (!list.includes(heading)) list.push(heading);
      cited.set(m[1], list);
    }
  }
  return cited;
}

/**
 * The use case and quality IDs in the register
 * @param {string} register
 */
export function registerIds(register) {
  return new Set(
    [...register.matchAll(/^###\s+((?:UC|Q)-\d+)\b/gm)].map((m) => m[1]),
  );
}

/**
 * What's wrong with a row's hand-kept columns
 * @param {IndexRow} row
 * @param {Set<string>} ids the register's IDs
 * @returns {string[]}
 */
export function rowProblems(row, ids) {
  const problems = [];
  const kinds = row.relationship
    .split(/[,;]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  for (const kind of kinds) {
    if (!RELATIONSHIPS.includes(kind)) {
      problems.push(
        `${row.key}: unknown relationship "${kind}" (use ${RELATIONSHIPS.join(", ")})`,
      );
    }
  }
  if (kinds.includes("none") && kinds.length > 1) {
    problems.push(
      `${row.key}: "none" can't be combined with another relationship`,
    );
  }
  for (const id of row.useCases.match(/\b(?:UC|Q)-\d+\b/g) ?? []) {
    if (!ids.has(id)) problems.push(`${row.key}: ${id} isn't in ${REGISTER}`);
  }
  return problems;
}

/**
 * Is the row a candidate feature: Romper doesn't touch it, no issue is
 * cited, and nobody has said it isn't a gap?
 * @param {IndexRow} row
 */
export function isCandidate(row) {
  return (
    row.relationship.trim().toLowerCase() === "none" &&
    !/#\d+/.test(row.notes) &&
    !/\bnot a gap\b/i.test(row.notes)
  );
}

/**
 * The committed index
 * @param {object} options
 * @param {Map<string, string[]>} options.concepts anchor → domain-model headings
 * @param {string} options.fetched
 * @param {IndexRow[]} options.rows
 * @param {string | null} options.version
 */
export function renderIndex({ concepts, fetched, rows, version }) {
  const top = rows.filter((r) => !r.key.includes(" › ")).length;
  const conceptCell = (/** @type {IndexRow} */ row) =>
    row.key.includes(" › ")
      ? ""
      : (concepts.get(row.anchor) ?? [])
          .map((h) => `[${h}](domain-model.md#${headingSlug(h)})`)
          .join(", ");
  const body = rows.map((row) =>
    [
      cell(row.key),
      `[#${row.anchor}](${MANUAL_URL}#${row.anchor})`,
      `\`${row.hash}\``,
      row.changed,
      cell(row.relationship),
      cell(row.useCases),
      conceptCell(row),
      cell(row.notes),
    ].join(" | "),
  );
  return [
    "# Rample manual index",
    "",
    "<!-- Generated by scripts/rample-manual-index.mjs (the rample-manual-map",
    "skill). Edit only the Relationship, Use cases and Notes columns: a run",
    "keeps them and regenerates everything else. -->",
    "",
    `**Source:** ${MANUAL_URL}`,
    "",
    `**Fetched:** ${fetched}`,
    "",
    `**Manual version:** ${version ?? "not stated on the page"}`,
    "",
    `**Sections:** ${top} headings, ${rows.length - top} sub-headings`,
    "",
    "Which Rample features Romper supports, mirrors or ignores ([Q-08](use-cases.md#q-08-romper-supports-or-mirrors-the-ramples-features)),",
    "section by section. The manual is Squarp's: this index holds only its",
    "headings, anchors and a hash of each section's text, so a later run can",
    "tell which sections changed. Read the text on the page.",
    "",
    "- **Section:** the heading, or `Heading › SUB-HEADING` for a bold line",
    "  inside it, like a Settings entry. It's the key that keeps a row's",
    "  mapping across runs.",
    "- **Anchor:** the box's id on the page. The ids look generated, so",
    "  they're recorded, not used as keys. A sub-heading has its box's anchor.",
    "- **Text hash** and **Changed:** a hash of the section's text, and the",
    "  fetch date it last changed.",
    "- **Relationship:** `writes` (Romper writes what the Rample reads from",
    "  the card), `mirrors` (Romper reproduces it for preview, without the",
    "  card), `documents` (Romper's docs explain it) or `none`. Combine with",
    "  commas. Blank means not mapped yet.",
    "- **Use cases:** the [use cases and qualities](use-cases.md) it relates to.",
    "- **Concepts:** the [domain model](domain-model.md) concepts that cite the",
    "  section (generated).",
    "- **Notes:** in our own words. A `none` row is a candidate feature until",
    "  its notes cite an issue (`#N`) or say why it's not a gap (\"Not a gap:",
    '  …").',
    "",
    `| ${TABLE_HEADER.join(" | ")} |`,
    `|${TABLE_HEADER.map(() => "---").join("|")}|`,
    ...body.map((line) => `| ${line} |`),
    "",
  ].join("\n");
}

/**
 * The run's report, as lines
 * @param {object} options
 * @param {Map<string, string[]>} options.concepts
 * @param {Merged} options.merged
 * @param {string | null} options.previousFetch
 * @param {string[]} options.problems
 * @param {string[]} options.staleCitations
 */
export function report({
  concepts,
  merged,
  previousFetch,
  problems,
  staleCitations,
}) {
  const rowByKey = new Map(merged.rows.map((r) => [r.key, r]));
  /** @param {string} key */
  const impact = (key) => {
    const row = rowByKey.get(key);
    if (!row) return "";
    const parts = [
      row.useCases && `use cases: ${row.useCases}`,
      concepts.get(row.anchor)?.length &&
        `concepts: ${concepts.get(row.anchor)?.join(", ")}`,
    ].filter(Boolean);
    return parts.length > 0 ? ` (${parts.join("; ")})` : "";
  };
  /** @param {string} title @param {string[]} items */
  const list = (title, items) =>
    items.length === 0
      ? []
      : ["", `${title} (${items.length}):`, ...items.map((i) => `- ${i}`)];
  const unmapped = merged.rows.filter((r) => !r.relationship.trim());
  const candidates = merged.rows.filter(isCandidate);
  const since = previousFetch ? ` since ${previousFetch}` : "";
  return [
    `Rample manual: ${merged.rows.length} sections and sub-headings.`,
    ...list(
      `Text changed${since}`,
      merged.changed.map((c) => `${c.key}${impact(c.key)}`),
    ),
    ...list("New", merged.added),
    ...list(
      "Renamed (mapping kept)",
      merged.renamed.map((r) => `${r.from} → ${r.to}`),
    ),
    ...list(
      "Removed",
      merged.removed.map(
        (r) =>
          `${r.key} (${[r.relationship || "unmapped", r.useCases].filter(Boolean).join("; ")}${r.notes ? `; ${r.notes}` : ""})`,
      ),
    ),
    ...list(
      "Not mapped yet",
      unmapped.map((r) => r.key),
    ),
    ...list(
      "Candidate features (none, no issue, not marked not a gap)",
      candidates.map((r) => `${r.key}${r.notes ? `: ${r.notes}` : ""}`),
    ),
    ...list("Citations of anchors the page no longer has", staleCitations),
    ...list("Problems", problems),
  ];
}

/**
 * Markdown files under a folder
 * @param {string} dir
 * @returns {string[]}
 */
function markdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.join(e.parentPath, e.name));
}

/**
 * Citations in docs/ of anchors the page no longer has
 * @param {string} root
 * @param {Set<string>} anchors this run's anchors
 */
function findStaleCitations(root, anchors) {
  const stale = [];
  for (const file of markdownFiles(path.join(root, "docs"))) {
    const rel = path.relative(root, file);
    if (rel === INDEX) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(
      /squarp\.net\/rample\/manual\/#([^)\s"'<>`]+)/g,
    )) {
      if (!anchors.has(m[1])) stale.push(`${rel}: #${m[1]}`);
    }
  }
  return [...new Set(stale)];
}

/**
 * A file name for a section's cached text
 * @param {string} key
 */
export function cacheName(key) {
  return `${key
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, "-")
    .replaceAll(/^-|-$/g, "")}.txt`;
}

/**
 * Keep the fetched page and each section's text out of git, with the last
 * run's text in previous/
 * @param {string} root
 * @param {string} html
 * @param {Section[]} sections
 */
function writeCache(root, html, sections) {
  const cache = path.join(root, CACHE);
  const current = path.join(cache, "sections");
  const previous = path.join(cache, "previous");
  fs.mkdirSync(cache, { recursive: true });
  if (fs.existsSync(current)) {
    fs.rmSync(previous, { force: true, recursive: true });
    fs.renameSync(current, previous);
  }
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(path.join(cache, "manual.html"), html);
  for (const section of sections) {
    fs.writeFileSync(
      path.join(current, cacheName(section.key)),
      `${section.key}\n${MANUAL_URL}#${section.anchor}\n\n${section.text}\n`,
    );
  }
}

/**
 * Today's date, YYYY-MM-DD, local time
 */
function today() {
  const d = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Fetch (or read), parse, merge, write and report. Resolves to the exit code.
 * @param {object} [options]
 * @param {string} [options.date] the fetch date to stamp
 * @param {boolean} [options.dryRun] report only
 * @param {(url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean, status: number, text(): Promise<string> }>} [options.fetchImpl]
 * @param {boolean} [options.force] write even if most sections vanished
 * @param {string} [options.htmlFile] parse this saved page instead
 * @param {{ log: (line: string) => void, error: (line: string) => void }} [options.log]
 * @param {string} [options.root]
 * @returns {Promise<0 | 1>}
 */
export async function run({
  date = today(),
  dryRun = false,
  fetchImpl = fetch,
  force = false,
  htmlFile,
  log = console,
  root = ROOT,
} = {}) {
  let html;
  if (htmlFile) {
    html = fs.readFileSync(htmlFile, "utf8");
  } else {
    const response = await fetchImpl(MANUAL_URL, {
      headers: { "User-Agent": "romper-rample-manual-index" },
    });
    if (!response.ok) {
      log.error(`Couldn't fetch ${MANUAL_URL}: HTTP ${response.status}`);
      return 1;
    }
    html = await response.text();
  }
  const { sections, version } = parseManual(html);
  const indexPath = path.join(root, INDEX);
  const previous = fs.existsSync(indexPath)
    ? parseIndex(fs.readFileSync(indexPath, "utf8"))
    : { fetched: null, rows: [] };
  const previousTop = previous.rows.filter((r) => !r.key.includes(" › "));
  const top = sections.filter((s) => s.parent === null);
  if (top.length === 0 || (!force && top.length < previousTop.length / 2)) {
    log.error(
      `Found ${top.length} sections on the page, where the index has ${previousTop.length}. The page's layout may have changed: check the parser (parseManual), or rerun with --force.`,
    );
    return 1;
  }
  const merged = mergeSections(previous.rows, sections, date);
  const read = (/** @type {string} */ rel) => {
    const file = path.join(root, rel);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  };
  const concepts = citationsByAnchor(read(DOMAIN_MODEL));
  const ids = registerIds(read(REGISTER));
  const problems = merged.rows.flatMap((row) => rowProblems(row, ids));
  const staleCitations = findStaleCitations(
    root,
    new Set(sections.map((s) => s.anchor)),
  );
  if (!dryRun) {
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(
      indexPath,
      renderIndex({ concepts, fetched: date, rows: merged.rows, version }),
    );
    writeCache(root, html, sections);
  }
  for (const line of report({
    concepts,
    merged,
    previousFetch: previous.fetched,
    problems,
    staleCitations,
  })) {
    log.log(line);
  }
  if (!dryRun) {
    log.log("");
    log.log(
      `Wrote ${INDEX}. Section text is in ${CACHE}/sections/ (not committed);`,
    );
    log.log(`diff -ru ${CACHE}/previous ${CACHE}/sections shows what changed.`);
  }
  return problems.length > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const htmlAt = args.indexOf("--html");
  const htmlFile = htmlAt === -1 ? undefined : args[htmlAt + 1];
  const unknown = args.filter(
    (a, i) =>
      a !== "--dry-run" &&
      a !== "--force" &&
      !(htmlAt !== -1 && (i === htmlAt || i === htmlAt + 1)),
  );
  if (unknown.length > 0 || (htmlAt !== -1 && !htmlFile)) {
    console.error(
      `Unknown option ${unknown[0] ?? "--html"}. Options: --html <file>, --dry-run, --force`,
    );
    process.exit(2);
  }
  try {
    process.exit(
      await run({
        dryRun: args.includes("--dry-run"),
        force: args.includes("--force"),
        htmlFile: htmlFile && path.resolve(htmlFile),
      }),
    );
  } catch (error) {
    console.error(/** @type {Error} */ (error).message);
    process.exit(1);
  }
}

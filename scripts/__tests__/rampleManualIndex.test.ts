// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cacheName,
  citationsByAnchor,
  decodeEntities,
  hashText,
  headingSlug,
  isCandidate,
  MANUAL_URL,
  mergeSections,
  parseIndex,
  parseManual,
  registerIds,
  renderIndex,
  report,
  rowProblems,
  run,
  splitRow,
  textOf,
} from "../rample-manual-index.mjs";

// A synthetic page shaped like the Rample manual (boxes with generated ids,
// a title div, bold sub-headings); none of its text is Squarp's.
const FIXTURE = path.join(__dirname, "fixtures", "rample-manual.html");
const html = fs.readFileSync(FIXTURE, "utf8");

/** An index row with blank hand-kept columns */
function row(key: string, anchor: string, hash: string, extra = {}) {
  return {
    anchor,
    changed: "2026-01-01",
    hash,
    key,
    notes: "",
    relationship: "",
    useCases: "",
    ...extra,
  };
}

describe("[Q-08] Rample manual index: parsing the page", () => {
  const { sections, version } = parseManual(html);

  it("keys each titled box by its heading, with its div id as the anchor", () => {
    expect(sections.map((s) => [s.key, s.anchor])).toEqual([
      ['Pick a "patch"', "aB3/x+Q"],
      ["Options", "Zz9"],
      ["Options › CLEAR", "Zz9"],
      ["Options › OUT1, OUT2", "Zz9"],
      ["Options › SAVE ALL", "Zz9"],
      ['Pick a "patch" (2)', "Rr1"],
    ]);
  });

  it("takes the plain text after the title, without scripts, styles, comments or attributes", () => {
    expect(sections[0].text).toBe(
      "A patch holds four sounds. Turn the knob & press it. P0 to P9",
    );
    expect(sections[0].hash).toBe(hashText(sections[0].text));
  });

  it("splits a box at bold lines of upper-case words, not bold words in a sentence", () => {
    const options = sections.filter((s) => s.anchor === "Zz9");
    expect(options[0].text).toBe("Press the menu knob:");
    expect(options[1].text).toBe("Clears every value.");
    // A bold `?X` in a sentence doesn't start a sub-heading
    expect(options[2].text).toBe(
      "Pick the note for each output. A folder named ?X where: ? is a letter",
    );
    expect(options[3].text).toContain("Saves the options.");
    expect(options[1].parent).toBe("Options");
    expect(sections[1].parent).toBeNull();
  });

  it("leaves out group boxes, the footer and boxes without a title", () => {
    const all = sections.map((s) => s.text).join(" ");
    expect(all).not.toContain("Group intro");
    expect(all).not.toContain("Footer");
    expect(all).not.toContain("without a title");
    expect(sections.some((s) => s.key.includes("?"))).toBe(false);
  });

  it("finds a version the page's sections state", () => {
    expect(version).toBe("2.4.1");
    expect(
      parseManual(html.replace("widgetOS v2.4.1", "the latest OS")).version,
    ).toBeNull();
  });

  it("decodes entities and collapses whitespace", () => {
    expect(decodeEntities("&#x27;&#39;&amp;&nbsp;&bogus;&ndash;")).toBe(
      "''& &bogus;–",
    );
    expect(textOf("<p>a</p>\n<br/>  b&quot;</p>")).toBe('a b"');
  });
});

describe("[Q-08] Rample manual index: the committed file", () => {
  const rows = [
    row("A › B", "x/1", "aaa", {
      notes: "Romper | not here; #12",
      relationship: "none",
      useCases: "UC-01",
    }),
    row("C", "y+2", "bbb", { relationship: "writes, mirrors" }),
  ];
  const concepts = new Map([["y+2", ["Kit", "Local store (library)"]]]);
  const markdown = renderIndex({
    concepts,
    fetched: "2026-10-08",
    rows,
    version: null,
  });

  it("round-trips rows, keeping the hand-kept columns and escaped pipes", () => {
    const parsed = parseIndex(markdown);
    expect(parsed.fetched).toBe("2026-10-08");
    expect(parsed.rows).toEqual(rows);
  });

  it("stamps the fetch date and version, and links anchors and concepts", () => {
    expect(markdown).toContain("**Manual version:** not stated on the page");
    expect(markdown).toContain(`[#y+2](${MANUAL_URL}#y+2)`);
    expect(markdown).toContain(
      "[Kit](domain-model.md#kit), [Local store (library)](domain-model.md#local-store-library)",
    );
    expect(markdown).toContain("**Sections:** 1 headings, 1 sub-headings");
    expect(
      renderIndex({ concepts, fetched: "d", rows, version: "1.2" }),
    ).toContain("**Manual version:** 1.2");
  });

  it("has no rows when there's no table", () => {
    expect(parseIndex("# Nothing yet\n")).toEqual({ fetched: null, rows: [] });
    expect(splitRow(String.raw`| a \| b | c |`)).toEqual([
      String.raw`a \| b`,
      "c",
    ]);
  });
});

describe("[Q-08] Rample manual index: comparing with the last run", () => {
  const { sections } = parseManual(html);
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));

  it("keeps the mapping by heading, and reports changed text", () => {
    const previous = [
      row("Options", "Zz9", byKey.Options.hash, { relationship: "none" }),
      row("Options › CLEAR", "Zz9", "0ld", {
        relationship: "mirrors",
        useCases: "UC-33",
      }),
    ];
    const merged = mergeSections(previous, sections, "2026-10-08");
    const options = merged.rows.find((r) => r.key === "Options");
    const clear = merged.rows.find((r) => r.key === "Options › CLEAR");
    expect(options).toMatchObject({
      changed: "2026-01-01",
      relationship: "none",
    });
    expect(clear).toMatchObject({
      changed: "2026-10-08",
      relationship: "mirrors",
      useCases: "UC-33",
    });
    expect(merged.changed).toEqual([
      {
        hash: byKey["Options › CLEAR"].hash,
        key: "Options › CLEAR",
        previousHash: "0ld",
      },
    ]);
    expect(merged.added).toContain('Pick a "patch"');
    expect(merged.removed).toEqual([]);
  });

  it("follows a renamed box by its anchor, and a renamed sub-heading by its text", () => {
    const previous = [
      row("Choose a patch", "aB3/x+Q", "old", { relationship: "writes" }),
      row("Options › WIPE", "Zz9", byKey["Options › CLEAR"].hash, {
        relationship: "none",
      }),
      row("Gone", "Gone1", "ggg", { notes: "x", relationship: "none" }),
    ];
    const merged = mergeSections(previous, sections, "2026-10-08");
    expect(merged.renamed).toEqual([
      { from: "Choose a patch", to: 'Pick a "patch"' },
      { from: "Options › WIPE", to: "Options › CLEAR" },
    ]);
    expect(merged.rows[0].relationship).toBe("writes");
    expect(merged.changed.map((c) => c.key)).toEqual(['Pick a "patch"']);
    expect(merged.removed.map((r) => r.key)).toEqual(["Gone"]);
  });
});

describe("[Q-08] Rample manual index: mapping checks and the report", () => {
  it("joins each anchor to the domain model headings that cite it", () => {
    const cited = citationsByAnchor(
      [
        "## Kit",
        "See [Select](https://squarp.net/rample/manual/#igGTWqk) and [it](https://squarp.net/rample/manual/#igGTWqk).",
        "### Stereo",
        "[x](https://squarp.net/rample/manual/#Gssvcjr)",
        "## Rample manual coverage",
        "[x](https://squarp.net/rample/manual/#Gssvcjr)",
      ].join("\n"),
    );
    expect(Object.fromEntries(cited)).toEqual({
      Gssvcjr: ["Stereo"],
      igGTWqk: ["Kit"],
    });
    expect(headingSlug("Playback and voice choke")).toBe(
      "playback-and-voice-choke",
    );
    expect(headingSlug("Q-08 Romper supports the Rample's features")).toBe(
      "q-08-romper-supports-the-ramples-features",
    );
  });

  it("flags unknown relationships and use case IDs", () => {
    const ids = registerIds("### UC-01 One\n### Q-08 Eight\n## UC-02 not\n");
    expect([...ids]).toEqual(["UC-01", "Q-08"]);
    expect(
      rowProblems(
        row("S", "a", "h", { relationship: "writes", useCases: "UC-01, Q-08" }),
        ids,
      ),
    ).toEqual([]);
    expect(
      rowProblems(
        row("S", "a", "h", { relationship: "none, copies", useCases: "UC-99" }),
        ids,
      ),
    ).toEqual([
      'S: unknown relationship "copies" (use writes, mirrors, documents, none)',
      'S: "none" can\'t be combined with another relationship',
      "S: UC-99 isn't in docs/developer/use-cases.md",
    ]);
  });

  it("counts a none row as a candidate until it cites an issue or says it's not a gap", () => {
    expect(isCandidate(row("S", "a", "h", { relationship: "none" }))).toBe(
      true,
    );
    expect(
      isCandidate(row("S", "a", "h", { notes: "#617", relationship: "none" })),
    ).toBe(false);
    expect(
      isCandidate(
        row("S", "a", "h", {
          notes: "Not a gap: navigation",
          relationship: "None",
        }),
      ),
    ).toBe(false);
    expect(isCandidate(row("S", "a", "h", { relationship: "writes" }))).toBe(
      false,
    );
  });

  it("reports changes with the use cases and concepts they affect", () => {
    const lines = report({
      concepts: new Map([["a", ["Kit"]]]),
      merged: {
        added: ["New one"],
        changed: [{ hash: "n", key: "S", previousHash: "o" }],
        removed: [
          row("Old", "o", "h", { notes: "gone", relationship: "none" }),
        ],
        renamed: [{ from: "R0", to: "R1" }],
        rows: [
          row("S", "a", "n", { relationship: "writes", useCases: "UC-01" }),
          row("New one", "b", "h"),
          row("Gap", "c", "h", { notes: "effects", relationship: "none" }),
        ],
      },
      previousFetch: "2026-10-01",
      problems: ["S: bad"],
      staleCitations: ["docs/x.md: #zz"],
    });
    expect(lines.join("\n")).toBe(
      [
        "Rample manual: 3 sections and sub-headings.",
        "",
        "Text changed since 2026-10-01 (1):",
        "- S (use cases: UC-01; concepts: Kit)",
        "",
        "New (1):",
        "- New one",
        "",
        "Renamed (mapping kept) (1):",
        "- R0 → R1",
        "",
        "Removed (1):",
        "- Old (none; gone)",
        "",
        "Not mapped yet (1):",
        "- New one",
        "",
        "Candidate features (none, no issue, not marked not a gap) (1):",
        "- Gap: effects",
        "",
        "Citations of anchors the page no longer has (1):",
        "- docs/x.md: #zz",
        "",
        "Problems (1):",
        "- S: bad",
      ].join("\n"),
    );
  });

  it("names cache files after the section key", () => {
    expect(cacheName("Settings › SP1, SP2")).toBe("settings-sp1-sp2.txt");
  });
});

describe("[Q-08] Rample manual index: a run", () => {
  let root: string;
  let out: string[];
  let err: string[];
  const log = {
    error: (line: string) => err.push(line),
    log: (line: string) => out.push(line),
  };
  const indexFile = () =>
    path.join(root, "docs/developer/rample-manual-index.md");

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "rample-manual-"));
    out = [];
    err = [];
    fs.mkdirSync(path.join(root, "docs/developer"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/developer/use-cases.md"),
      "### UC-33 Slicer\n",
    );
    fs.writeFileSync(
      path.join(root, "docs/developer/domain-model.md"),
      "## Kit\n[Options](https://squarp.net/rample/manual/#Zz9) [old](https://squarp.net/rample/manual/#gone)\n",
    );
  });
  afterEach(() => fs.rmSync(root, { force: true, recursive: true }));

  it("writes the index and the cache, then keeps the mapping and reports a change", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => html,
    });
    expect(await run({ date: "2026-10-08", fetchImpl, log, root })).toBe(0);
    const first = fs.readFileSync(indexFile(), "utf8");
    expect(first).toContain("**Fetched:** 2026-10-08");
    expect(first).toContain("[Kit](domain-model.md#kit)");
    expect(out).toContain("- docs/developer/domain-model.md: #gone");
    const cache = path.join(root, ".cache/rample-manual");
    expect(fs.existsSync(path.join(cache, "manual.html"))).toBe(true);
    expect(
      fs.readFileSync(path.join(cache, "sections/options-clear.txt"), "utf8"),
    ).toContain("Clears every value.");

    // Map a row by hand, then rerun on a page whose CLEAR text changed
    fs.writeFileSync(
      indexFile(),
      first.replace(
        /(\| Options › CLEAR \|[^|]*\|[^|]*\|[^|]*\|) *\| *\|/,
        "$1 mirrors | UC-33 |",
      ),
    );
    const changed = path.join(root, "changed.html");
    fs.writeFileSync(changed, html.replace("Clears every", "Wipes every"));
    out = [];
    expect(
      await run({ date: "2026-11-01", htmlFile: changed, log, root }),
    ).toBe(0);
    const second = parseIndex(fs.readFileSync(indexFile(), "utf8"));
    expect(second.rows.find((r) => r.key === "Options › CLEAR")).toMatchObject({
      changed: "2026-11-01",
      relationship: "mirrors",
      useCases: "UC-33",
    });
    expect(second.rows.find((r) => r.key === "Options")?.changed).toBe(
      "2026-10-08",
    );
    expect(out).toContain("Text changed since 2026-10-08 (1):");
    expect(out).toContain(
      "- Options › CLEAR (use cases: UC-33; concepts: Kit)",
    );
    expect(
      fs.readFileSync(path.join(cache, "previous/options-clear.txt"), "utf8"),
    ).toContain("Clears every value.");
  });

  it("writes nothing on a dry run, and exits 1 on a mapping problem", async () => {
    fs.writeFileSync(
      indexFile(),
      renderIndex({
        concepts: new Map(),
        fetched: "2026-10-01",
        rows: [row("Options", "Zz9", "h", { relationship: "copies" })],
        version: null,
      }),
    );
    const before = fs.readFileSync(indexFile(), "utf8");
    expect(await run({ dryRun: true, htmlFile: FIXTURE, log, root })).toBe(1);
    expect(fs.readFileSync(indexFile(), "utf8")).toBe(before);
    expect(fs.existsSync(path.join(root, ".cache"))).toBe(false);
    expect(out.join("\n")).toContain('unknown relationship "copies"');
  });

  it("stops when the fetch fails or the page's layout has changed", async () => {
    const failing = async () => ({
      ok: false,
      status: 503,
      text: async () => "",
    });
    expect(await run({ fetchImpl: failing, log, root })).toBe(1);
    expect(err[0]).toContain("HTTP 503");

    const empty = path.join(root, "empty.html");
    fs.writeFileSync(empty, "<html><body><p>Moved.</p></body></html>");
    expect(await run({ force: true, htmlFile: empty, log, root })).toBe(1);
    expect(fs.existsSync(indexFile())).toBe(false);

    fs.writeFileSync(
      indexFile(),
      renderIndex({
        concepts: new Map(),
        fetched: "2026-10-01",
        rows: ["a", "b", "c", "d", "e", "f", "g"].map((k) => row(k, k, "h")),
        version: null,
      }),
    );
    expect(await run({ htmlFile: FIXTURE, log, root })).toBe(1);
    expect(err.at(-1)).toContain("where the index has 7");
    expect(await run({ force: true, htmlFile: FIXTURE, log, root })).toBe(0);
  });
});

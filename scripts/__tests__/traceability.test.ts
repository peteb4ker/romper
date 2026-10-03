// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildIndex,
  findProblems,
  layerOf,
  parseBacklog,
  parseRegister,
  render,
  scanTests,
  slug,
  summarise,
} from "../traceability.mjs";

const REGISTER = `# Use cases

## Setup

### UC-01 Set up from an SD card

**Status:** supported

### UC-02 Set up from the factory archive

**Status:** partial

### UC-03 Set up an empty library

**Status:** supported
**Test gap:** no e2e for the empty
option yet.

- **Renderer:** not part of the gap.
`;

describe("layerOf", () => {
  it("takes the layer from the file name", () => {
    expect(layerOf("app/a/__tests__/A.test.tsx")).toBe("unit");
    expect(layerOf("electron/x.integration.test.ts")).toBe("integration");
    expect(layerOf("tests/e2e/x.e2e.test.ts")).toBe("e2e");
    expect(layerOf("tests/validation/full.validation.ts")).toBe("validation");
    expect(layerOf("tests/validation/support/card.ts")).toBeNull();
    expect(layerOf("app/a/A.tsx")).toBeNull();
  });
});

describe("parseRegister", () => {
  it("reads IDs, names, statuses and declared gaps", () => {
    const { errors, useCases } = parseRegister(REGISTER);
    expect(errors).toEqual([]);
    expect(
      useCases.map(({ gap, id, name, status }) => ({ gap, id, name, status })),
    ).toEqual([
      {
        gap: null,
        id: "UC-01",
        name: "Set up from an SD card",
        status: "supported",
      },
      {
        gap: null,
        id: "UC-02",
        name: "Set up from the factory archive",
        status: "partial",
      },
      {
        gap: "no e2e for the empty option yet.",
        id: "UC-03",
        name: "Set up an empty library",
        status: "supported",
      },
    ]);
  });

  it("reports a missing or unknown status and duplicate IDs", () => {
    const { errors } = parseRegister(
      "### UC-01 A\n\n### UC-02 B\n**Status:** maybe\n### UC-02 C\n**Status:** partial\n",
    );
    expect(errors).toEqual([
      'UC-02: unknown status "maybe"',
      "UC-01 has no **Status:** line",
      "UC-02 has no **Status:** line",
      "UC-02 appears twice in docs/developer/use-cases.md",
    ]);
  });
});

describe("scanTests", () => {
  it("applies a describe's tags to every test inside it", () => {
    const { tags, tests } = scanTests(`
      describe("[UC-01] setup", () => {
        it("imports kits", () => {});
        describe.each([1, 2])("case %s", () => {
          it("[UC-02] also downloads", () => {});
        });
      });
      test("untagged", () => {});
    `);
    expect(tags.map((t) => t.id)).toEqual(["UC-01", "UC-02"]);
    expect(tests.map((t) => t.covered.map((c) => c.id))).toEqual([
      ["UC-01"],
      ["UC-01", "UC-02"],
      [],
    ]);
  });

  it("reads Playwright's test.describe and ignores steps and hooks", () => {
    const { tests } = scanTests(`
      test.describe.serial("[UC-14] Create a kit", () => {
        test.beforeEach(async () => {});
        test("creates one", async () => {
          await test.step("[UC-99] not a test", async () => {});
        });
      });
    `);
    expect(tests).toHaveLength(1);
    expect(tests[0].covered.map((c) => c.id)).toEqual(["UC-14"]);
  });
});

describe("findProblems and render", () => {
  const { useCases } = parseRegister(REGISTER);
  const files: Record<string, string> = {
    "a/A.test.ts": `describe("[UC-01] a", () => { it("x", () => {}); it("y", () => {}); });`,
    "tests/e2e/b.e2e.test.ts": `test("[UC-01] [UC-42] b", async () => {});`,
  };
  const scan = buildIndex(Object.keys(files), (f: string) => files[f]);

  it("flags unknown IDs and untested supported use cases, and accepts declared gaps", () => {
    const problems = findProblems(useCases, scan);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/tests\/e2e\/b\.e2e\.test\.ts:1: \[UC-42\]/);
  });

  it("fails a supported use case with only unit tests and no declared gap", () => {
    const unitOnly = buildIndex(["a/A.test.ts"], (f: string) => files[f]);
    const problems = findProblems(useCases, unitOnly);
    expect(problems).toEqual([
      expect.stringContaining("UC-01 Set up from an SD card is supported"),
    ]);
  });

  it("fails a declared gap once it's closed", () => {
    const closed = buildIndex(
      ["tests/e2e/c.e2e.test.ts"],
      () => `test("[UC-01] [UC-03] c", async () => {});`,
    );
    expect(findProblems(useCases, closed)).toEqual([
      expect.stringContaining("UC-03 Set up an empty library now has a test"),
    ]);
  });

  it("counts tests per layer and links each file at its first tag", () => {
    const md = render(useCases, scan);
    expect(md).toContain(
      "| [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card) Set up from an SD card | supported | [2](#uc-01) | - | [1](#uc-01) | - |",
    );
    expect(md).toContain(
      "- E2E: [`tests/e2e/b.e2e.test.ts`](../../tests/e2e/b.e2e.test.ts#L1) (1 test)",
    );
    expect(md).toContain(
      "- [UC-03](use-cases.md#uc-03-set-up-an-empty-library) Set up an empty library: no e2e for the empty option yet.",
    );
    expect(md).toContain("3 of 3 tests carry a use case tag.");
  });

  it("links to a commit on GitHub when given a base URL (the CI summary)", () => {
    const base = "https://github.com/o/r/blob/abc/";
    const md = render(useCases, scan, { base });
    expect(md).toContain(
      `| [UC-01](${base}docs/developer/use-cases.md#uc-01-set-up-from-an-sd-card) Set up from an SD card |`,
    );
    expect(md).toContain(
      `- E2E: [\`tests/e2e/b.e2e.test.ts\`](${base}tests/e2e/b.e2e.test.ts#L1) (1 test)`,
    );
  });
});

describe("slug", () => {
  it("matches GitHub's heading anchors", () => {
    expect(slug("UC-13 Scan a kit, or scan all")).toBe(
      "uc-13-scan-a-kit-or-scan-all",
    );
  });
});

describe("tracing the backlog to user-oriented statements", () => {
  const register = `# Use cases

## Samples

### UC-19 Drop WAVs onto a voice

**Status:** partial

- **Known issues:** RE-40 (silent failures), RE-28,
  RE-89.

## Qualities

### Q-01 Romper stays responsive as your library grows

**Status:** partial

- **Known issues:** RE-36, OPS-1.
`;
  const backlog = `# Backlog

## Later

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-28 | Medium | DB | Some changes are saved in several steps. | open |
| RE-36 | Medium | Performance | Every edit reloads your library. | open |
| RE-40 | Medium | Renderer | Some failures happen silently. | open |
| RE-89 | Medium | Samples | Dropped samples miss their \`wav_*\` details. | open |
| RE-90 | Medium | Samples | Nobody lists this one. | open |

## Owner (needs Pete)

| ID | Item | Status |
|---|---|---|
| OPS-1 | Require e2e before merging. | open |

## Done

| ID | Severity | Area | Item | Status |
|---|---|---|---|---|
| RE-11 | High | Renderer | Messages never appeared. | done (#300) |
`;

  it("reads groups, qualities and known issues across wrapped lines", () => {
    const { useCases } = parseRegister(register);
    expect(useCases.map((u) => [u.id, u.kind, u.group, u.issues])).toEqual([
      ["UC-19", "use case", "Samples", ["RE-40", "RE-28", "RE-89"]],
      ["Q-01", "quality", "Qualities", ["RE-36", "OPS-1"]],
    ]);
  });

  it("reads both backlog tables and knows what's done", () => {
    const items = parseBacklog(backlog);
    expect(items.get("OPS-1")).toMatchObject({
      done: false,
      item: "Require e2e before merging.",
    });
    expect(items.get("RE-11")?.done).toBe(true);
    expect(items.get("RE-36")?.done).toBe(false);
  });

  it("fails an open item no entry lists, a listed item that's done or unknown, and code in a one-liner", () => {
    const { useCases } = parseRegister(
      register.replace("RE-36, OPS-1", "RE-36, OPS-1, RE-11, RE-99"),
    );
    const scan = buildIndex([], () => "");
    expect(findProblems(useCases, scan, parseBacklog(backlog))).toEqual([
      expect.stringContaining("Q-01 lists RE-11, which BACKLOG.md marks done"),
      expect.stringContaining("Q-01 lists RE-99, which isn't in BACKLOG.md"),
      expect.stringContaining(
        "RE-89: write its BACKLOG.md one-liner in plain language",
      ),
      expect.stringContaining(
        "RE-90 is open in BACKLOG.md but no use case or quality lists it",
      ),
    ]);
  });

  it("summarises each entry for the testing page", () => {
    const { useCases } = parseRegister(register);
    const scan = buildIndex(
      ["tests/e2e/d.e2e.test.ts"],
      () => `test("[UC-19] [Q-01] drop", async () => {});`,
    );
    const [drop] = summarise(useCases, scan, parseBacklog(backlog));
    expect(drop).toMatchObject({
      group: "Samples",
      id: "UC-19",
      issues: [
        { id: "RE-40", text: "Some failures happen silently." },
        { id: "RE-28", text: "Some changes are saved in several steps." },
        { id: "RE-89", text: "Dropped samples miss their `wav_*` details." },
      ],
      status: "partial",
      tests: { e2e: 1, integration: 0, unit: 0, validation: 0 },
    });
  });
});

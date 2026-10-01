// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildIndex,
  findProblems,
  layerOf,
  parseRegister,
  render,
  scanTests,
  slug,
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
    expect(useCases).toEqual([
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
});

describe("slug", () => {
  it("matches GitHub's heading anchors", () => {
    expect(slug("UC-13 Scan a kit, or scan all")).toBe(
      "uc-13-scan-a-kit-or-scan-all",
    );
  });
});

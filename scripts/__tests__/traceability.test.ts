// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildIndex,
  findProblems,
  issueProblems,
  layerOf,
  parseRegister,
  readGitHub,
  render,
  run,
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

describe("tracing GitHub issues to user-oriented statements", () => {
  const register = `# Use cases

## Samples

### UC-19 Drop WAVs onto a voice

**Status:** partial

### UC-20 Replace a sample

**Status:** not built

### UC-23 Delete a sample

**Status:** supported

## Qualities

### Q-01 Romper stays responsive as your library grows

**Status:** partial
`;
  const { useCases } = parseRegister(register);
  const labels = ["UC-19", "UC-20", "UC-23", "Q-01", "bug", "question"];
  const issue = (number: number, ...issueLabels: string[]) => ({
    labels: issueLabels,
    number,
    title: `Issue ${number}`,
  });
  const healthy = {
    fixing: [] as number[],
    issues: [issue(1, "UC-19", "bug"), issue(2, "Q-01", "UC-19")],
    labels,
  };

  it("reads groups and kinds", () => {
    expect(useCases.map((u) => [u.id, u.kind, u.group])).toEqual([
      ["UC-19", "use case", "Samples"],
      ["UC-20", "use case", "Samples"],
      ["UC-23", "use case", "Samples"],
      ["Q-01", "quality", "Qualities"],
    ]);
  });

  it("passes when every issue is labelled and statuses follow the issues", () => {
    expect(issueProblems(useCases, healthy)).toEqual([]);
  });

  it("fails an issue with no UC or Q label, unless it isn't a work item", () => {
    const github = {
      ...healthy,
      issues: [
        ...healthy.issues,
        issue(3, "bug"),
        issue(4, "question"),
        issue(5, "dependencies"),
      ],
    };
    expect(issueProblems(useCases, github)).toEqual([
      expect.stringContaining(
        '#3 ("Issue 3") has no use case or quality label',
      ),
    ]);
  });

  it("fails an issue labelled with an ID the register doesn't have", () => {
    const github = {
      ...healthy,
      issues: [...healthy.issues, issue(6, "UC-99", "UC-19")],
    };
    expect(issueProblems(useCases, github)).toEqual([
      "#6 is labelled UC-99, which isn't in docs/developer/use-cases.md.",
    ]);
  });

  it("fails an entry with no label on GitHub", () => {
    const github = { ...healthy, labels: labels.filter((l) => l !== "UC-20") };
    expect(issueProblems(useCases, github)).toEqual([
      expect.stringContaining("UC-20 has no label on GitHub"),
    ]);
  });

  it("fails a supported entry with an open issue", () => {
    const github = {
      ...healthy,
      issues: [...healthy.issues, issue(7, "UC-23", "bug")],
    };
    expect(issueProblems(useCases, github)).toEqual([
      expect.stringContaining(
        "UC-23 Delete a sample is supported but has open issues (#7)",
      ),
    ]);
  });

  it("fails a partial entry with no open issue, but not a not-built one", () => {
    const github = { ...healthy, issues: [issue(2, "Q-01")] };
    expect(issueProblems(useCases, github)).toEqual([
      expect.stringContaining(
        "UC-19 Drop WAVs onto a voice is partial but no open issue is labelled UC-19",
      ),
    ]);
  });

  it("counts the issues the current pull request fixes as closed", () => {
    const github = { ...healthy, fixing: [1, 2] };
    expect(issueProblems(useCases, github)).toEqual([
      expect.stringContaining("UC-19 Drop WAVs onto a voice is partial"),
      expect.stringContaining("Q-01 Romper stays responsive"),
    ]);
  });

  it("runs the issue checks from findProblems only when GitHub was read", () => {
    const scan = buildIndex(
      ["tests/e2e/x.e2e.test.ts"],
      () => `test("[UC-23] delete", async () => {});`,
    );
    const github = { ...healthy, issues: [] };
    expect(findProblems(useCases, scan, github)).toHaveLength(2);
    expect(findProblems(useCases, scan, null)).toEqual([]);
  });

  it("summarises each entry for the testing page", () => {
    const scan = buildIndex(
      ["tests/e2e/d.e2e.test.ts"],
      () => `test("[UC-19] [Q-01] drop", async () => {});`,
    );
    const [drop, , remove] = summarise(useCases, scan, healthy);
    expect(drop).toEqual({
      gap: null,
      group: "Samples",
      id: "UC-19",
      kind: "use case",
      name: "Drop WAVs onto a voice",
      openIssues: 2,
      status: "partial",
      tests: { e2e: 1, integration: 0, unit: 0, validation: 0 },
    });
    expect(remove.openIssues).toBe(0);
    expect(summarise(useCases, scan)[0].openIssues).toBeNull();
  });

  it("reads open issues, labels and the pull request's fixes with gh", () => {
    const calls: string[][] = [];
    const exec = (_cmd: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "pr") return "459\n";
      if (args[1] === "--paginate" && args[2].includes("/labels")) {
        return "UC-19\nbug\n";
      }
      return '{"labels":["UC-19"],"number":1,"title":"A"}\n';
    };
    const github = readGitHub({
      env: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/pull/42/merge" },
      exec,
      root: ".",
    });
    expect(github).toEqual({
      fixing: [459],
      issues: [{ labels: ["UC-19"], number: 1, title: "A" }],
      labels: ["UC-19", "bug"],
    });
    expect(calls[2].slice(0, 3)).toEqual(["pr", "view", "42"]);
  });

  it("doesn't look for a pull request on a push in GitHub Actions", () => {
    const exec = (_cmd: string, args: string[]) => {
      if (args[0] === "pr") throw new Error("not expected");
      return "";
    };
    expect(
      readGitHub({
        env: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main" },
        exec,
        root: ".",
      }).fixing,
    ).toEqual([]);
  });
});

describe("run without GitHub", () => {
  const unavailable = () => {
    throw Object.assign(new Error("gh failed"), {
      stderr: "gh: To get started with GitHub CLI, please run: gh auth login\n",
    });
  };
  const quiet = () => {
    const out: string[] = [];
    return {
      log: {
        error: (m: string) => out.push(m),
        log: (m: string) => out.push(m),
      },
      out,
    };
  };

  it("skips the issue checks locally, with a notice", () => {
    const { log, out } = quiet();
    run({ check: true, env: {}, github: unavailable, log });
    expect(out[0]).toBe(
      "Skipping the issue checks: can't read GitHub issues with gh (gh: To get started with GitHub CLI, please run: gh auth login).",
    );
  });

  it("fails in GitHub Actions, where the checks must run", () => {
    const { log, out } = quiet();
    expect(
      run({
        check: true,
        env: { GITHUB_ACTIONS: "true" },
        github: unavailable,
        log,
        summaryFile: undefined,
      }),
    ).toBe(1);
    expect(out[0]).toContain("can't read GitHub issues");
  });
});

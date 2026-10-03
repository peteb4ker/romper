// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildIndex,
  deriveStatuses,
  findProblems,
  issueProblems,
  layerOf,
  parseRegister,
  readGitHub,
  render,
  renderIssueChecks,
  run,
  scanTests,
  slug,
  statusLines,
  summarise,
} from "../traceability.mjs";

const REGISTER = `# Use cases

## Setup

### UC-01 Set up from an SD card

Copies the card's kits.

### UC-02 Set up from the factory archive

**Status:** not built

### UC-03 Set up an empty library

**Test gap:** no e2e for the empty
option yet.

- **Renderer:** not part of the gap.
`;

const issue = (number: number, ...issueLabels: string[]) => ({
  labels: issueLabels,
  number,
  title: `Issue ${number}`,
});

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
  it("reads IDs, names, not-built markers and declared gaps", () => {
    const { errors, useCases } = parseRegister(REGISTER);
    expect(errors).toEqual([]);
    expect(
      useCases.map(({ gap, id, name, notBuilt }) => ({
        gap,
        id,
        name,
        notBuilt,
      })),
    ).toEqual([
      {
        gap: null,
        id: "UC-01",
        name: "Set up from an SD card",
        notBuilt: false,
      },
      {
        gap: null,
        id: "UC-02",
        name: "Set up from the factory archive",
        notBuilt: true,
      },
      {
        gap: "no e2e for the empty option yet.",
        id: "UC-03",
        name: "Set up an empty library",
        notBuilt: false,
      },
    ]);
  });

  it("refuses a hand-set supported or partial status, and duplicate IDs", () => {
    const { errors } = parseRegister(
      "### UC-01 A\n**Status:** supported\n### UC-02 B\n**Status:** partial\n### UC-02 C\n**Status:** not built\n",
    );
    expect(errors).toEqual([
      expect.stringContaining(
        'UC-01: remove its "**Status:** supported" line from docs/developer/use-cases.md',
      ),
      expect.stringContaining('UC-02: remove its "**Status:** partial" line'),
      "UC-02 appears twice in docs/developer/use-cases.md",
    ]);
    expect(errors[0]).toContain(
      'Supported and partial are generated from the open issues; only "not built" is set by hand.',
    );
  });
});

describe("deriveStatuses", () => {
  const { useCases } = parseRegister(REGISTER);
  const github = (
    issues: ReturnType<typeof issue>[],
    fixing: number[] = [],
  ) => ({
    fixing,
    issues,
    labels: [],
  });
  const statuses = (entries: { id: string; status: null | string }[]) =>
    entries.map(({ id, status }) => [id, status]);

  it("makes an entry partial while an issue with its label is open, and supported when none is", () => {
    const entries = deriveStatuses(
      useCases,
      github([issue(9, "UC-03", "bug"), issue(4, "UC-03", "test")]),
    );
    expect(statuses(entries)).toEqual([
      ["UC-01", "supported"],
      ["UC-02", "not built"],
      ["UC-03", "partial"],
    ]);
    expect(entries[2].openIssues).toEqual([4, 9]);
    expect(entries[0].openIssues).toEqual([]);
  });

  it("keeps not built whatever is open, such as an issue to build it", () => {
    const entries = deriveStatuses(
      useCases,
      github([issue(5, "UC-02", "enhancement"), issue(6, "UC-02", "bug")]),
    );
    expect(entries[1]).toMatchObject({
      openIssues: [5, 6],
      status: "not built",
    });
  });

  it("ignores issues that need triage or don't count as work", () => {
    const entries = deriveStatuses(
      useCases,
      github([
        issue(1, "UC-01", "triage"),
        issue(2, "UC-01", "question"),
        issue(3, "UC-01", "duplicate"),
      ]),
    );
    expect(entries[0].status).toBe("supported");
  });

  it("counts the issues the current pull request fixes as closed", () => {
    const entries = deriveStatuses(
      useCases,
      github([issue(1, "UC-01", "bug"), issue(2, "UC-03", "bug")], [1]),
    );
    expect(statuses(entries)).toEqual([
      ["UC-01", "supported"],
      ["UC-02", "not built"],
      ["UC-03", "partial"],
    ]);
  });

  it("leaves a built entry's status unknown without GitHub", () => {
    expect(statuses(deriveStatuses(useCases, null))).toEqual([
      ["UC-01", null],
      ["UC-02", "not built"],
      ["UC-03", null],
    ]);
  });

  it("lists the statuses for the console, partial entries with their issues", () => {
    expect(
      statusLines(deriveStatuses(useCases, github([issue(7, "UC-03", "bug")]))),
    ).toEqual([
      expect.stringContaining("Status, generated from the open issues"),
      "  supported (1): UC-01",
      "  partial (1): UC-03 (#7)",
      "  not built (1): UC-02",
    ]);
    expect(statusLines(deriveStatuses(useCases, null))).toContain(
      "  unknown (2) (can't read GitHub): UC-01, UC-03",
    );
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
  const entries = deriveStatuses(useCases, {
    fixing: [],
    issues: [issue(3, "UC-01", "bug"), issue(8, "UC-01", "test")],
    labels: [],
  });

  it("flags unknown IDs, whatever GitHub says", () => {
    const problems = findProblems(useCases, scan);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/tests\/e2e\/b\.e2e\.test\.ts:1: \[UC-42\]/);
  });

  it("leaves an untested use case to the issue checks, since its status comes from GitHub", () => {
    const unitOnly = buildIndex(["a/A.test.ts"], (f: string) => files[f]);
    expect(findProblems(useCases, unitOnly)).toEqual([]);
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
    const md = render(entries, scan);
    expect(md).toContain(
      "| [UC-01](use-cases.md#uc-01-set-up-from-an-sd-card) Set up from an SD card | partial ([2 open](https://github.com/peteb4ker/romper/issues?q=is%3Aopen+label%3AUC-01)) | [2](#uc-01) | - | [1](#uc-01) | - |",
    );
    expect(md).toContain(
      "- E2E: [`tests/e2e/b.e2e.test.ts`](../../tests/e2e/b.e2e.test.ts#L1) (1 test)",
    );
    expect(md).toContain(
      "- [UC-03](use-cases.md#uc-03-set-up-an-empty-library) Set up an empty library: no e2e for the empty option yet.",
    );
    expect(md).toContain("3 of 3 tests carry a use case tag.");
  });

  it("lists the generated statuses, each ID linking to its open issues", () => {
    const md = render(entries, scan);
    expect(md).toContain("3 use cases: 1 supported, 1 partial, 1 not built.");
    expect(md).toContain(
      "| partial (1) | [UC-01](https://github.com/peteb4ker/romper/issues?q=is%3Aopen+label%3AUC-01) |",
    );
    expect(md).toContain(
      "| not built (1) | [UC-02](https://github.com/peteb4ker/romper/issues?q=is%3Aopen+label%3AUC-02) |",
    );
    expect(render(deriveStatuses(useCases, null), scan)).toContain(
      "3 use cases: 1 not built, 2 unknown.",
    );
  });

  it("links to a commit on GitHub when given a base URL (the CI summary)", () => {
    const base = "https://github.com/o/r/blob/abc/";
    const md = render(entries, scan, { base });
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

### UC-20 Replace a sample

**Status:** not built

### UC-23 Delete a sample

## Qualities

### Q-01 Romper stays responsive as your library grows
`;
  const { useCases } = parseRegister(register);
  const labels = ["UC-19", "UC-20", "UC-23", "Q-01", "bug", "question"];
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

  it("passes when every issue and entry is labelled", () => {
    expect(issueProblems(useCases, healthy)).toEqual({
      problems: [],
      triage: [],
    });
  });

  it("lists an issue with no UC or Q label, or labelled triage, as needing triage, not as a problem", () => {
    const github = {
      ...healthy,
      issues: [
        ...healthy.issues,
        issue(3, "bug"),
        issue(4, "question"),
        issue(5, "dependencies"),
        issue(8, "triage", "UC-23"),
      ],
    };
    expect(issueProblems(useCases, github)).toEqual({
      problems: [],
      triage: [
        expect.stringContaining('#3 ("Issue 3") needs triage'),
        expect.stringContaining('#8 ("Issue 8") needs triage'),
      ],
    });
  });

  it("reports an issue labelled with an ID the register doesn't have", () => {
    const github = {
      ...healthy,
      issues: [...healthy.issues, issue(6, "UC-99", "UC-19")],
    };
    expect(issueProblems(useCases, github).problems).toEqual([
      "#6 is labelled UC-99, which isn't in docs/developer/use-cases.md.",
    ]);
  });

  it("reports an entry with no label on GitHub", () => {
    const github = { ...healthy, labels: labels.filter((l) => l !== "UC-20") };
    expect(issueProblems(useCases, github).problems).toEqual([
      expect.stringContaining("UC-20 has no label on GitHub"),
    ]);
  });

  it("reports a supported entry with no test above unit level, not a partial or not-built one", () => {
    // UC-19 and Q-01 have open issues; UC-20 isn't built; UC-23 has none
    const unitOnly = buildIndex(
      ["a/A.test.ts"],
      () => `test("[UC-19] [UC-23] [Q-01] unit", () => {});`,
    );
    expect(issueProblems(useCases, healthy, unitOnly).problems).toEqual([
      "UC-23 Delete a sample is supported (no open issues) but has no integration, e2e or validation test. " +
        "Tag one with [UC-23], declare the gap with a **Test gap:** line in docs/developer/use-cases.md, " +
        "or open a test issue labelled UC-23.",
    ]);
  });

  it("checks the status the current pull request's fixes bring", () => {
    // Fixing #1 and #2 leaves UC-19 and Q-01 with no open issues
    const none = buildIndex([], () => "");
    expect(
      issueProblems(useCases, { ...healthy, fixing: [1, 2] }, none).problems,
    ).toEqual([
      expect.stringContaining("UC-19 Drop WAVs onto a voice is supported"),
      expect.stringContaining("UC-23 Delete a sample is supported"),
      expect.stringContaining("Q-01 Romper stays responsive"),
    ]);
  });

  it("accepts a supported entry that declares its gap", () => {
    const { useCases: gapped } = parseRegister(
      "### UC-23 Delete a sample\n\n**Test gap:** needs a real desktop.\n",
    );
    expect(
      issueProblems(
        gapped,
        { fixing: [], issues: [], labels: ["UC-23"] },
        buildIndex([], () => ""),
      ).problems,
    ).toEqual([]);
  });

  it("keeps the issue checks out of findProblems", () => {
    const scan = buildIndex(
      ["tests/e2e/x.e2e.test.ts"],
      () => `test("[UC-23] delete", async () => {});`,
    );
    expect(findProblems(useCases, scan)).toEqual([]);
  });

  it("renders the issue checks for the job summary", () => {
    const md = renderIssueChecks(
      { problems: ["UC-23 has no label"], triage: ["#3 needs triage"] },
      { strict: false },
    );
    expect(md).toContain("### Warnings (1)\n\n- UC-23 has no label");
    expect(md).toContain("### Needs triage (1)\n\n- #3 needs triage");
    expect(
      renderIssueChecks({ problems: ["x"], triage: [] }, { strict: true }),
    ).toContain("### Failures (1)");
  });

  it("summarises each entry for the testing page", () => {
    const scan = buildIndex(
      ["tests/e2e/d.e2e.test.ts"],
      () => `test("[UC-19] [Q-01] drop", async () => {});`,
    );
    const [drop, replace, remove] = summarise(useCases, scan, healthy);
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
    expect(remove).toMatchObject({ openIssues: 0, status: "supported" });
    expect(replace).toMatchObject({ openIssues: 0, status: "not built" });
    expect(summarise(useCases, scan)[0]).toMatchObject({
      openIssues: null,
      status: null,
    });
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

  it("finds no fixes locally when the branch has no pull request", () => {
    const exec = (_cmd: string, args: string[]) => {
      if (args[0] === "pr") throw new Error("no pull requests found");
      return "";
    };
    expect(readGitHub({ env: {}, exec, root: "." }).fixing).toEqual([]);
  });

  it("fails when the pull request being checked in GitHub Actions can't be read", () => {
    const exec = (_cmd: string, args: string[]) => {
      if (args[0] === "pr") throw new Error("Resource not accessible");
      return "";
    };
    expect(() =>
      readGitHub({
        env: { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/pull/42/merge" },
        exec,
        root: ".",
      }),
    ).toThrow("Resource not accessible");
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

describe("run: pull requests warn, the release fails", () => {
  const register = `# Use cases

## Samples

### UC-19 Drop WAVs onto a voice

### UC-20 Replace a sample

**Status:** not built

### UC-23 Delete a sample
`;
  let root: string;
  let summary: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "romper-trace-"));
    fs.mkdirSync(path.join(root, "docs/developer"), { recursive: true });
    fs.mkdirSync(path.join(root, "tests/e2e"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/developer/use-cases.md"), register);
    fs.writeFileSync(
      path.join(root, "tests/e2e/a.e2e.test.ts"),
      `test("[UC-19] a", async () => {});`,
    );
    summary = path.join(root, "summary.md");
  });
  afterEach(() => fs.rmSync(root, { force: true, recursive: true }));

  // UC-23 is partial (#1), so it needs no test yet; #2 hasn't been triaged;
  // #3 names an entry the register lacks; UC-20 has no label on GitHub.
  const github = () => ({
    fixing: [] as number[],
    issues: [
      { labels: ["UC-23", "bug"], number: 1, title: "A" },
      { labels: ["triage"], number: 2, title: "B" },
      { labels: ["UC-99", "bug"], number: 3, title: "C" },
    ],
    labels: ["UC-19", "UC-23"],
  });
  // Everything a release needs, except that UC-23 is supported untested
  const untested = () => ({
    fixing: [] as number[],
    issues: [],
    labels: ["UC-19", "UC-20", "UC-23"],
  });
  const capture = () => {
    const out: string[] = [];
    const log = {
      error: (m: string) => out.push(m),
      log: (m: string) => out.push(m),
    };
    return { log, out };
  };

  it("warns on a pull request, with annotations and the job summary", () => {
    const { log, out } = capture();
    const code = run({
      check: true,
      env: { GITHUB_ACTIONS: "true" },
      github,
      log,
      root,
      summaryFile: summary,
    });
    expect(code).toBe(0);
    expect(out).toContainEqual(
      "::warning title=Release blocker::#3 is labelled UC-99, which isn't in docs/developer/use-cases.md.",
    );
    expect(out).toContainEqual(
      expect.stringMatching(
        /^::warning title=Release blocker::UC-20 has no label on GitHub/,
      ),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/^::notice title=Needs triage::#2 \("B"\)/),
    );
    expect(out).toContain("  partial (1): UC-23 (#1)");
    const md = fs.readFileSync(summary, "utf8");
    expect(md).toContain("## Status");
    expect(md).toContain("| supported (1) | [UC-19](");
    expect(md).toContain("### Warnings (2)");
    expect(md).toContain("### Needs triage (1)");
  });

  it("fails with --strict-issues, but not on an issue that needs triage", () => {
    const { log, out } = capture();
    expect(
      run({ check: true, env: {}, github, log, root, strictIssues: true }),
    ).toBe(1);
    expect(out).toContain("Traceability check failed (2):");
    expect(out).toContainEqual(
      expect.stringContaining("- #3 is labelled UC-99"),
    );
    expect(out).toContainEqual(
      expect.stringContaining("- UC-20 has no label on GitHub"),
    );

    const triageOnly = () => ({
      ...github(),
      issues: github().issues.slice(0, 2),
      labels: ["UC-19", "UC-20", "UC-23"],
    });
    expect(
      run({
        check: true,
        env: {},
        github: triageOnly,
        log: capture().log,
        root,
        strictIssues: true,
      }),
    ).toBe(0);
  });

  it("fails a release, and warns a pull request, on a supported use case with no test above unit level", () => {
    const release = capture();
    expect(
      run({
        check: true,
        env: {},
        github: untested,
        log: release.log,
        root,
        strictIssues: true,
      }),
    ).toBe(1);
    expect(release.out).toContainEqual(
      expect.stringContaining(
        "- UC-23 Delete a sample is supported (no open issues) but has no integration, e2e or validation test.",
      ),
    );

    const pr = capture();
    expect(
      run({ check: true, env: {}, github: untested, log: pr.log, root }),
    ).toBe(0);
    expect(pr.out).toContainEqual(
      expect.stringMatching(/^warning: UC-23 Delete a sample is supported/),
    );
  });

  it("still fails a pull request on the test rules", () => {
    fs.writeFileSync(
      path.join(root, "tests/e2e/a.e2e.test.ts"),
      `test("[UC-19] [UC-77] a", async () => {});`,
    );
    const { log } = capture();
    expect(
      run({
        check: true,
        env: {},
        github: () => ({ ...github(), issues: [] }),
        log,
        root,
      }),
    ).toBe(1);
  });

  it("fails on a hand-set supported or partial status, in every mode", () => {
    fs.writeFileSync(
      path.join(root, "docs/developer/use-cases.md"),
      register.replace(
        "### UC-23 Delete a sample\n",
        "### UC-23 Delete a sample\n\n**Status:** supported\n",
      ),
    );
    for (const check of [false, true]) {
      const { log, out } = capture();
      expect(run({ check, env: {}, github, log, root })).toBe(1);
      expect(out[0]).toContain(
        'UC-23: remove its "**Status:** supported" line',
      );
    }
  });

  it("prints the statuses and writes the matrix with them (npm run trace)", () => {
    const { log, out } = capture();
    expect(run({ env: {}, github, log, root })).toBe(0);
    expect(out).toEqual([
      expect.stringContaining("Status, generated from the open issues"),
      "  supported (1): UC-19",
      "  partial (1): UC-23 (#1)",
      "  not built (1): UC-20",
      expect.stringContaining("Wrote docs/developer/traceability.md"),
    ]);
    const md = fs.readFileSync(
      path.join(root, "docs/developer/traceability.md"),
      "utf8",
    );
    expect(md).toContain("3 use cases: 1 supported, 1 partial, 1 not built.");
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
      "Skipping the issue checks and showing statuses as unknown: can't read GitHub issues with gh (gh: To get started with GitHub CLI, please run: gh auth login).",
    );
  });

  it("warns on a pull request in GitHub Actions", () => {
    const { log, out } = quiet();
    expect(
      run({
        check: true,
        env: { GITHUB_ACTIONS: "true" },
        github: unavailable,
        log,
        summaryFile: undefined,
      }),
    ).toBe(0);
    expect(out[0]).toMatch(
      /^::warning title=Traceability::Skipping the issue checks/,
    );
  });

  it("fails with --strict-issues, which needs the issues", () => {
    const { log, out } = quiet();
    expect(
      run({
        check: true,
        env: {},
        github: unavailable,
        log,
        strictIssues: true,
        summaryFile: undefined,
      }),
    ).toBe(1);
    expect(out[0]).toContain("--strict-issues needs the GitHub issues");
  });
});

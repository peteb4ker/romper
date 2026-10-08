// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  annotations,
  flakyTests,
  summaryMarkdown,
} from "../e2e-flaky-summary.mjs";

const result = (status: string, message?: string) => ({
  status,
  ...(message ? { error: { message } } : {}),
});

const spec = (
  title: string,
  status: string,
  results: ReturnType<typeof result>[],
) => ({
  file: "tests/e2e/kit-cards.e2e.test.ts",
  line: 12,
  tests: [{ projectName: "electron", results, status }],
  title,
});

// Playwright's JSON report: a suite per spec file, describes nested in it
const report = {
  suites: [
    {
      file: "tests/e2e/kit-cards.e2e.test.ts",
      specs: [spec("passes", "expected", [result("passed")])],
      suites: [
        {
          specs: [
            spec("flakes", "flaky", [
              result(
                "failed",
                "\u001b[31mError: expect(locator).toBeVisible() failed\u001b[39m\n\nLocator: getByTestId('kit-A0')",
              ),
              result("passed"),
            ]),
            spec("fails", "unexpected", [
              result("failed", "Error: nope"),
              result("failed", "Error: nope"),
            ]),
            spec("times out, then passes", "flaky", [
              result("timedOut"),
              result("passed"),
            ]),
          ],
          title: "Kit cards | grid",
        },
      ],
      title: "tests/e2e/kit-cards.e2e.test.ts",
    },
  ],
};

describe("[Q-07] e2e flaky summary (#659)", () => {
  it("lists only the tests that passed on retry, with the first failure", () => {
    expect(flakyTests(report)).toEqual([
      {
        error: "Error: expect(locator).toBeVisible() failed",
        file: "tests/e2e/kit-cards.e2e.test.ts",
        line: 12,
        title: "Kit cards | grid › flakes",
      },
      {
        error: "timedOut",
        file: "tests/e2e/kit-cards.e2e.test.ts",
        line: 12,
        title: "Kit cards | grid › times out, then passes",
      },
    ]);
  });

  it("finds none in a report without retries, or no report body", () => {
    expect(flakyTests({ suites: [] })).toEqual([]);
    expect(flakyTests(undefined)).toEqual([]);
  });

  it("asks for an issue per flaky test in the job summary", () => {
    const markdown = summaryMarkdown(flakyTests(report), "ubuntu-latest");

    expect(markdown).toContain("### E2E retries (ubuntu-latest)");
    expect(markdown).toContain(
      "2 tests failed, then passed when CI retried them",
    );
    expect(markdown).toContain("file an issue for each");
    // A | in a title would break the table
    expect(markdown).toContain(
      "| Kit cards \\| grid › flakes | `tests/e2e/kit-cards.e2e.test.ts:12` |",
    );
  });

  it("says so when no test needed a retry", () => {
    expect(summaryMarkdown([], "macos-latest")).toBe(
      "### E2E retries (macos-latest)\n\nNo test needed a retry.\n",
    );
  });

  it("annotates each flaky spec with a warning", () => {
    expect(annotations(flakyTests(report))[0]).toBe(
      "::warning file=tests/e2e/kit-cards.e2e.test.ts,line=12,title=Flaky e2e test::" +
        "Kit cards | grid › flakes failed, then passed on retry. File an issue for it.",
    );
  });
});

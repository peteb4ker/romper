// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  type Check,
  decide,
  formatResult,
  frozenFiles,
  historyStartLine,
  idsFromLink,
  type Memory,
  nextCleanPolls,
  OUTCOMES,
  parseArgs,
  pullRequestProblem,
  runnerNeverAcquired,
  sameLockfile,
  type Snapshot,
  splitFailures,
  touchesBacklogHistory,
} from "../ship-pr.mjs";

const memory = (overrides: Partial<Memory> = {}): Memory => ({
  armed: true,
  cleanPolls: 0,
  rerunJobs: [],
  rerunWorkflows: [],
  ...overrides,
});

const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  checks: [],
  mergeStateStatus: "BLOCKED",
  sonar: { code: 0, head: true },
  state: "OPEN",
  ...overrides,
});

const check = (overrides: Partial<Check> = {}): Check => ({
  bucket: "pass",
  jobId: "200",
  name: "unit-tests",
  runId: "100",
  workflow: "Test",
  ...overrides,
});

const openPr = {
  baseRefName: "main",
  headRefName: "fix/1-thing",
  isCrossRepository: false,
  isDraft: false,
  labels: [],
  state: "OPEN",
};

describe("[Q-07] ship-pr, the shepherd's merge script", () => {
  describe("parseArgs", () => {
    it("reads the PR number and defaults", () => {
      expect(parseArgs(["796"])).toEqual({
        dryRun: false,
        maxPolls: 90,
        pollSeconds: 60,
        pr: "796",
      });
    });

    it("reads --dry-run and the polling flags", () => {
      expect(
        parseArgs([
          "--dry-run",
          "796",
          "--poll-seconds",
          "5",
          "--max-polls",
          "3",
        ]),
      ).toEqual({ dryRun: true, maxPolls: 3, pollSeconds: 5, pr: "796" });
    });

    it("refuses a missing PR, a stray argument and a bad number", () => {
      expect(parseArgs([])).toHaveProperty("error");
      expect(parseArgs(["796", "797"])).toHaveProperty("error");
      expect(parseArgs(["#796"])).toHaveProperty("error");
      expect(parseArgs(["796", "--max-polls", "0"])).toHaveProperty("error");
    });
  });

  describe("pullRequestProblem", () => {
    it("passes an open PR against main", () => {
      expect(pullRequestProblem(openPr)).toBeNull();
    });

    it.each([
      [{ state: "CLOSED" }, "not-open"],
      [{ isDraft: true }, "not-open"],
      [{ baseRefName: "release" }, "not-open"],
      [{ isCrossRepository: true }, "not-open"],
      [{ headRefName: "main" }, "not-open"],
      [{ labels: [{ name: "hold" }] }, "held"],
      [{ labels: [{ name: "UC-01" }, { name: "do-not-merge" }] }, "held"],
    ])("refuses %o as %s", (change, outcome) => {
      expect(pullRequestProblem({ ...openPr, ...change })?.outcome).toBe(
        outcome,
      );
    });
  });

  describe("frozen paths", () => {
    it("flags files under aidlc-docs/", () => {
      expect(
        frozenFiles([
          "aidlc-docs/inception/x.md",
          "docs/aidlc-docs.md",
          "scripts/a.mjs",
        ]),
      ).toEqual(["aidlc-docs/inception/x.md"]);
    });

    const backlog = [
      "# Backlog",
      "",
      "## Pick",
      "text",
      "",
      "## Fixed before the issue tracker",
      "",
      "| ID |",
    ].join("\n");

    it("finds the history heading", () => {
      expect(historyStartLine(backlog)).toBe(6);
      expect(historyStartLine("# Backlog\n")).toBeUndefined();
    });

    it("allows edits above the history list", () => {
      expect(touchesBacklogHistory("@@ -4 +4 @@\n-text\n+new\n", 6)).toBe(
        false,
      );
      // Inserted just before the heading
      expect(touchesBacklogHistory("@@ -5,0 +6,2 @@\n+a\n+b\n", 6)).toBe(false);
    });

    it("flags edits, insertions and deletions in the history list", () => {
      expect(touchesBacklogHistory("@@ -8 +8 @@\n-| ID |\n+| Id |\n", 6)).toBe(
        true,
      );
      expect(touchesBacklogHistory("@@ -6,0 +7 @@\n+row\n", 6)).toBe(true);
      expect(touchesBacklogHistory("@@ -4,3 +3,0 @@\n", 6)).toBe(true);
      expect(
        touchesBacklogHistory("@@ -2 +2 @@\n-a\n+b\n@@ -8,2 +8 @@\n", 6),
      ).toBe(true);
    });
  });

  describe("sameLockfile", () => {
    const pinned = (libc: string) =>
      `{\n  "node_modules/x": {\n    "version": "1.0.0",${libc}\n    "license": "MIT"\n  }\n}`;

    it("ignores npm's libc churn", () => {
      expect(
        sameLockfile(
          pinned(""),
          pinned('\n    "libc": [\n      "glibc"\n    ],'),
        ),
      ).toBe(true);
    });

    it("tells different pins apart", () => {
      expect(
        sameLockfile(pinned(""), pinned("").replace("1.0.0", "1.0.1")),
      ).toBe(false);
    });
  });

  describe("lost runners", () => {
    it("reads run and job IDs from a check's link", () => {
      expect(
        idsFromLink(
          "https://github.com/peteb4ker/romper/actions/runs/37883782503/job/113669143793",
        ),
      ).toEqual({ jobId: "113669143793", runId: "37883782503" });
      expect(idsFromLink("https://sonarcloud.io/dashboard")).toEqual({});
      expect(idsFromLink(undefined)).toEqual({});
    });

    it("knows a job no runner picked up", () => {
      const annotation = {
        message:
          "The job was not acquired by Runner of type hosted even after multiple attempts",
      };
      expect(runnerNeverAcquired({ steps: [] }, [annotation])).toBe(true);
      expect(runnerNeverAcquired({ steps: [] }, [])).toBe(true);
      expect(
        runnerNeverAcquired({ steps: [{ conclusion: "skipped" }] }, []),
      ).toBe(true);
    });

    it("knows a job whose steps ran", () => {
      expect(
        runnerNeverAcquired(
          { steps: [{ conclusion: "success" }, { conclusion: "failure" }] },
          [{ message: "Process completed with exit code 1." }],
        ),
      ).toBe(false);
    });

    it("reruns a lost runner and its run's aggregate check, once", () => {
      const lost = check({ bucket: "cancel", jobId: "1", runnerLost: true });
      const gate = check({
        bucket: "fail",
        jobId: "2",
        name: "e2e-tests-check",
      });
      expect(splitFailures([lost, gate], [])).toEqual({
        real: [],
        rerunnable: [lost, gate],
      });
      expect(splitFailures([lost], ["Test"])).toEqual({
        real: [lost],
        rerunnable: [],
      });
    });

    it("doesn't rerun a run with a real failure in it", () => {
      const lost = check({ bucket: "cancel", jobId: "1", runnerLost: true });
      const real = check({ bucket: "fail", jobId: "2", name: "unit-tests" });
      expect(splitFailures([lost, real], []).rerunnable).toEqual([]);
    });
  });

  describe("decide", () => {
    it("is done when the PR merged", () => {
      expect(decide(snapshot({ state: "MERGED" }), memory())).toEqual({
        action: "merged",
      });
    });

    it("stops on a closed PR", () => {
      expect(decide(snapshot({ state: "CLOSED" }), memory())).toMatchObject({
        action: "stop",
        outcome: "not-open",
      });
    });

    it("stops on new SonarCloud issues in the head's analysis", () => {
      expect(
        decide(snapshot({ sonar: { code: 1, head: true } }), memory()),
      ).toMatchObject({ action: "stop", outcome: "sonar" });
    });

    it("leaves an older analysis to the early exit, and waits for the head's", () => {
      expect(
        decide(
          snapshot({ sonar: { code: 1, head: false } }),
          memory({ armed: false }),
        ),
      ).toEqual({
        action: "wait",
        reason: "waiting for SonarCloud to analyze the head before arming",
      });
    });

    it("stops on a failed check, naming it", () => {
      const decision = decide(
        snapshot({
          checks: [check({ bucket: "fail" }), check({ name: "lint" })],
          mergeStateStatus: "BEHIND",
        }),
        memory(),
      );
      expect(decision).toEqual({
        action: "stop",
        detail: "check failed: unit-tests",
        outcome: "check-failed",
      });
    });

    it("reruns a lost runner once, then waits for the rerun", () => {
      const lost = check({
        bucket: "cancel",
        jobId: "9",
        name: "integration-tests (macos-latest)",
        runnerLost: true,
      });
      expect(decide(snapshot({ checks: [lost] }), memory())).toEqual({
        action: "rerun",
        jobIds: ["9"],
        runIds: ["100"],
        workflows: ["Test"],
      });
      const after = memory({ rerunJobs: ["9"], rerunWorkflows: ["Test"] });
      expect(decide(snapshot({ checks: [lost] }), after).action).toBe("wait");
      const again = { ...lost, jobId: "10" };
      expect(decide(snapshot({ checks: [again] }), after)).toMatchObject({
        action: "stop",
        outcome: "check-failed",
      });
    });

    it("stops on a conflict GitHub reports", () => {
      expect(
        decide(snapshot({ mergeStateStatus: "DIRTY" }), memory()),
      ).toMatchObject({ action: "stop", outcome: "conflict" });
    });

    it("rebases when behind", () => {
      expect(
        decide(snapshot({ mergeStateStatus: "BEHIND" }), memory()),
      ).toEqual({ action: "rebase" });
    });

    it("arms only once SonarCloud reports 0 issues on the pushed head", () => {
      const unarmed = memory({ armed: false });
      expect(decide(snapshot(), unarmed)).toEqual({ action: "arm" });
      // Not analyzed at all, or only an older commit analyzed, even if clean
      for (const sonar of [
        { code: 2, head: false },
        { code: 0, head: false },
      ]) {
        expect(decide(snapshot({ sonar }), unarmed).action).toBe("wait");
      }
    });

    it("doesn't arm a head with new issues", () => {
      expect(
        decide(
          snapshot({ sonar: { code: 1, head: true } }),
          memory({ armed: false }),
        ).action,
      ).toBe("stop");
    });

    it("waits once armed until auto-merge fires", () => {
      expect(decide(snapshot(), memory())).toEqual({
        action: "wait",
        reason: "merge state BLOCKED",
      });
    });

    it("merges directly after two clean polls, once the head is analyzed", () => {
      const clean = snapshot({ mergeStateStatus: "CLEAN" });
      expect(decide(clean, memory({ cleanPolls: 1 })).action).toBe("wait");
      expect(decide(clean, memory({ cleanPolls: 2 }))).toEqual({
        action: "merge",
      });
      // Green before arming (the analysis finished last): merge, don't arm
      expect(decide(clean, memory({ armed: false, cleanPolls: 2 }))).toEqual({
        action: "merge",
      });
      expect(
        decide(
          { ...clean, sonar: { code: 0, head: false } },
          memory({ cleanPolls: 2 }),
        ).action,
      ).toBe("wait");
    });

    it("counts clean polls in a row", () => {
      expect(nextCleanPolls("CLEAN", 1)).toBe(2);
      expect(nextCleanPolls("HAS_HOOKS", 0)).toBe(1);
      expect(nextCleanPolls("BLOCKED", 3)).toBe(0);
    });
  });

  describe("result line", () => {
    it("is one machine-readable line with the outcome's exit code", () => {
      expect(formatResult("conflict", "796", 'rebase "x" failed')).toBe(
        'ship-pr result=conflict pr=796 code=10 detail="rebase \\"x\\" failed"',
      );
    });

    it("gives every stopping outcome its own exit code", () => {
      const stops = Object.entries(OUTCOMES).filter(
        ([outcome]) => outcome !== "merged" && outcome !== "dry-run",
      );
      const codes = stops.map(([, code]) => code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes).not.toContain(0);
    });
  });
});

// @vitest-environment node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type Check,
  decide,
  formatResult,
  frozenFiles,
  historyStartLine,
  idsFromLink,
  linkNodeModules,
  type Memory,
  nextCleanPolls,
  nodeModulesProblem,
  OUTCOMES,
  parseArgs,
  pullRequestProblem,
  run,
  runnerNeverAcquired,
  sameLockfile,
  settleResult,
  type Snapshot,
  splitFailures,
  timeLeft,
  touchesBacklogHistory,
  unlinkNodeModules,
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

  describe("borrowed node_modules", () => {
    let root: string;
    let source: string;
    let scratch: string;
    const link = () => path.join(scratch, "node_modules");

    beforeEach(() => {
      root = mkdtempSync(path.join(tmpdir(), "ship-pr-test-"));
      source = path.join(root, "source");
      scratch = path.join(root, "scratch");
      mkdirSync(path.join(source, "node_modules", ".bin"), { recursive: true });
      writeFileSync(path.join(source, "node_modules", "marker"), "source");
      mkdirSync(scratch);
    });

    afterEach(() => {
      rmSync(root, { force: true, recursive: true });
    });

    const sourceIsIntact = () =>
      readFileSync(path.join(source, "node_modules", "marker"), "utf8") ===
        "source" && existsSync(path.join(source, "node_modules", ".bin"));

    const pointsAtSource = () =>
      lstatSync(link()).isSymbolicLink() &&
      path.resolve(scratch, readlinkSync(link())) ===
        path.join(source, "node_modules");

    it("links a fresh scratch tree to the source's node_modules", () => {
      expect(linkNodeModules(source, scratch)).toBe("linked");
      expect(pointsAtSource()).toBe(true);
      expect(existsSync(path.join(link(), "marker"))).toBe(true);
    });

    it("keeps a link that is already right, so a second rebase doesn't fail", () => {
      linkNodeModules(source, scratch);
      expect(linkNodeModules(source, scratch)).toBe("kept");
      expect(pointsAtSource()).toBe(true);
      expect(sourceIsIntact()).toBe(true);
    });

    it("replaces a stale link and leaves what it pointed at alone", () => {
      const elsewhere = path.join(root, "elsewhere");
      mkdirSync(elsewhere);
      writeFileSync(path.join(elsewhere, "marker"), "elsewhere");
      symlinkSync(elsewhere, link(), "dir");

      expect(linkNodeModules(source, scratch)).toBe("replaced");
      expect(pointsAtSource()).toBe(true);
      expect(readFileSync(path.join(elsewhere, "marker"), "utf8")).toBe(
        "elsewhere",
      );
      expect(sourceIsIntact()).toBe(true);
    });

    it("replaces a dangling link", () => {
      symlinkSync(path.join(root, "gone"), link(), "dir");
      expect(linkNodeModules(source, scratch)).toBe("replaced");
      expect(pointsAtSource()).toBe(true);
    });

    it("replaces a real folder (an earlier npm ci) with the link", () => {
      mkdirSync(path.join(link(), "left-over"), { recursive: true });
      writeFileSync(path.join(link(), "left-over", "file"), "x");

      expect(linkNodeModules(source, scratch)).toBe("replaced");
      expect(pointsAtSource()).toBe(true);
      expect(existsSync(path.join(link(), "left-over"))).toBe(false);
      expect(sourceIsIntact()).toBe(true);
    });

    it("unlinks only the link, never the source's node_modules", () => {
      linkNodeModules(source, scratch);
      expect(unlinkNodeModules(scratch)).toBe(true);
      expect(existsSync(link())).toBe(false);
      expect(sourceIsIntact()).toBe(true);
      expect(readdirSync(scratch)).toEqual([]);
    });

    it("leaves a real folder for the caller and reports nothing removed", () => {
      mkdirSync(link());
      expect(unlinkNodeModules(scratch)).toBe(false);
      expect(lstatSync(link()).isDirectory()).toBe(true);
      expect(unlinkNodeModules(path.join(root, "no-such-tree"))).toBe(false);
    });

    it("reports an environment problem when the source has no node_modules", () => {
      expect(nodeModulesProblem(source)).toBeNull();
      rmSync(path.join(source, "node_modules"), { recursive: true });
      expect(nodeModulesProblem(source)).toMatch(
        /node_modules is missing from .*source.*npm install/,
      );
    });

    it("has its own outcome and exit code, apart from typecheck", () => {
      expect(OUTCOMES.env).not.toBe(OUTCOMES.typecheck);
      expect(OUTCOMES.env).toBeGreaterThan(0);
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
  describe("a result that is wrong because the PR merged", () => {
    const noPause = { attempts: 3, pauseMs: 0 };
    const failed = { detail: "fetch failed", outcome: "error" as const };

    it("reports merged when a network error followed the merge", async () => {
      const recheck = () => ({
        mergedAt: "2026-10-10T08:25:26Z",
        state: "MERGED",
      });
      const result = await settleResult(failed, recheck, noPause);
      expect(result.outcome).toBe("merged");
      expect(result.detail).toContain("2026-10-10T08:25:26Z");
    });

    it("retries the re-check before giving up on it", async () => {
      let calls = 0;
      const recheck = () => {
        if (++calls < 3) throw new Error("fetch failed");
        return { mergedAt: "2026-10-10T08:25:26Z", state: "MERGED" };
      };
      const result = await settleResult(failed, recheck, noPause);
      expect(result.outcome).toBe("merged");
      expect(calls).toBe(3);
    });

    it("keeps the original result when the PR is still open", async () => {
      const recheck = () => ({ mergedAt: null, state: "OPEN" });
      const timeout = { detail: "gh timed out", outcome: "timeout" as const };
      expect(await settleResult(timeout, recheck, noPause)).toEqual(timeout);
    });

    it("keeps the original outcome when the re-check can't be made", async () => {
      const recheck = () => {
        throw new Error("fetch failed");
      };
      const result = await settleResult(failed, recheck, noPause);
      expect(result.outcome).toBe("error");
      expect(result.detail).toContain("couldn't re-check");
    });

    it("re-checks every non-merged outcome but not usage, merged or dry-run", async () => {
      let calls = 0;
      const recheck = () => {
        calls++;
        return { mergedAt: "t", state: "MERGED" };
      };
      for (const outcome of [
        "conflict",
        "sonar",
        "branch-moved",
        "timeout",
      ] as const) {
        expect(
          (await settleResult({ detail: "x", outcome }, recheck, noPause))
            .outcome,
        ).toBe("merged");
      }
      for (const outcome of ["usage", "merged", "dry-run"] as const) {
        const input = { detail: "x", outcome };
        expect(await settleResult(input, recheck, noPause)).toEqual(input);
      }
      expect(calls).toBe(4);
    });
  });

  describe("time limits", () => {
    it("stops a command that hangs, with a timeout rather than a wait", () => {
      const started = Date.now();
      expect(() =>
        run("node", ["-e", "setTimeout(() => {}, 30000)"], { timeoutMs: 300 }),
      ).toThrow(/timed out/);
      expect(Date.now() - started).toBeLessThan(10_000);
      try {
        run("node", ["-e", "setTimeout(() => {}, 30000)"], { timeoutMs: 300 });
      } catch (error) {
        expect((error as { outcome?: string }).outcome).toBe("timeout");
      }
    });

    it("still returns the output of a command that finishes", () => {
      const result = run("node", ["-e", "console.log('hi')"]);
      expect(result.ok).toBe(true);
      expect(result.stdout).toBe("hi");
    });

    it("gives a call its own limit while a dry run has time left", () => {
      expect(timeLeft(5000, Date.now() + 60_000, Date.now())).toBe(5000);
    });

    it("cuts a call short to fit what is left of the dry run's limit", () => {
      expect(timeLeft(5000, 1000 + 2000, 1000)).toBe(2000);
    });

    it("ends the dry run with a timeout once its limit has passed", () => {
      try {
        timeLeft(5000, 1000, 1000);
        expect.unreachable();
      } catch (error) {
        expect((error as { outcome?: string }).outcome).toBe("timeout");
      }
    });

    it("has no limit when none is set (a real run)", () => {
      expect(timeLeft(5000, Infinity, Date.now())).toBe(5000);
    });
  });
});

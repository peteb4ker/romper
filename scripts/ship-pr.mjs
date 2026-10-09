#!/usr/bin/env node
/**
 * Ship one PR: rebase it onto main, check it, push, arm auto-merge and
 * watch it merge. The PR shepherd runs it once per PR, in queue order; any
 * result but "merged" means stop and escalate, never fix (ship-pr skill).
 *
 *   npm run ship -- <pr-number> [--dry-run] [--poll-seconds N] [--max-polls N]
 *
 * It works in a scratch worktree of its own, detached at the PR's head, so
 * it never touches the author's worktree, and removes it when it exits:
 *
 *   1. Refuse a PR that isn't open, is a draft, isn't based on main, comes
 *      from a fork, or is labelled hold / do-not-merge.
 *   2. Refuse a diff that touches frozen paths: aidlc-docs/, or the
 *      "Fixed before the issue tracker" list in BACKLOG.md.
 *   3. Refuse new SonarCloud issues (sonar:pr) on the PR's latest analysis
 *      (an early exit: that analysis may be of the pre-rebase head).
 *   4. Rebase onto origin/main (any conflict: abort, stop), run
 *      `npm run typecheck` on the rebased tree (a clean rebase can still
 *      break the build), and push with --force-with-lease pinned to the
 *      head it started from. The typecheck borrows this checkout's
 *      node_modules by link; if this checkout has none, that's an
 *      environment problem ("env"), not the PR's.
 *   5. Poll. Auto-merge is armed (rebase) only once SonarCloud has
 *      analyzed the pushed head and reports 0 new issues, so a rebase that
 *      brings in new issues can't merge before they're seen. A check that
 *      fails because no runner ever picked it up is rerun once; any other
 *      failure stops it. BEHIND turns auto-merge off and rebases again
 *      (same rules), and the new head waits for its own analysis. CLEAN
 *      for two polls without merging (auto-merge stalls) merges directly
 *      with --rebase.
 *
 * --dry-run does steps 1-3 and predicts the rebase with `git merge-tree`,
 * then prints what it would do, without creating a worktree or pushing.
 *
 * The last line on stdout is the machine-readable result:
 *
 *   ship-pr result=<outcome> pr=<N> code=<exit code> detail="<text>"
 *
 * with one exit code per outcome (OUTCOMES below). It never pushes to
 * main, never skips hooks and never merges with --admin.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkPullRequest } from "./sonar-pr.mjs";

const REPO = "peteb4ker/romper";

/** Exit code for each outcome; "merged" and "dry-run" are the successes */
export const OUTCOMES = /** @type {const} */ ({
  merged: 0,
  "dry-run": 0,
  error: 1,
  usage: 2,
  conflict: 10,
  typecheck: 11,
  sonar: 12,
  frozen: 13,
  "check-failed": 14,
  "not-open": 15,
  held: 16,
  "branch-moved": 17,
  timeout: 18,
  env: 19,
});

/** @typedef {keyof typeof OUTCOMES} Outcome */

/** Labels that keep a PR out of the merge queue */
export const HOLD_LABELS = ["hold", "do-not-merge"];

/** The BACKLOG.md heading whose list is history, never edited */
export const BACKLOG_HISTORY_HEADING = "## Fixed before the issue tracker";

/**
 * @typedef {object} Options
 * @property {string} pr
 * @property {boolean} dryRun
 * @property {number} pollSeconds
 * @property {number} maxPolls
 */

/**
 * Read the command line.
 * @param {string[]} argv the arguments after the script's path
 * @returns {Options | { error: string }}
 */
export function parseArgs(argv) {
  /** @type {Options} */
  const options = { dryRun: false, maxPolls: 90, pollSeconds: 60, pr: "" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--poll-seconds" || arg === "--max-polls") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) {
        return { error: `${arg} needs a whole number above 0` };
      }
      if (arg === "--poll-seconds") options.pollSeconds = value;
      else options.maxPolls = value;
    } else if (/^\d+$/.test(arg) && !options.pr) {
      options.pr = arg;
    } else {
      return { error: `Unexpected argument: ${arg}` };
    }
  }
  if (!options.pr) return { error: "Which PR? Give its number." };
  return options;
}

/**
 * @typedef {object} PullRequest
 * @property {string} state OPEN, CLOSED or MERGED
 * @property {boolean} isDraft
 * @property {boolean} isCrossRepository
 * @property {string} baseRefName
 * @property {string} headRefName
 * @property {{ name: string }[]} labels
 */

/**
 * Why the PR can't be shipped as it stands, if it can't.
 * @param {PullRequest} pr
 * @returns {{ outcome: Outcome, detail: string } | null}
 */
export function pullRequestProblem(pr) {
  if (pr.state !== "OPEN") {
    return {
      detail: `the PR is ${pr.state.toLowerCase()}`,
      outcome: "not-open",
    };
  }
  if (pr.isDraft) return { detail: "the PR is a draft", outcome: "not-open" };
  if (pr.baseRefName !== "main") {
    return {
      detail: `the PR targets ${pr.baseRefName}, not main`,
      outcome: "not-open",
    };
  }
  if (pr.isCrossRepository || pr.headRefName === "main") {
    return {
      detail: "the PR's branch isn't a branch of this repo",
      outcome: "not-open",
    };
  }
  const held = pr.labels
    .map((l) => l.name)
    .filter((n) => HOLD_LABELS.includes(n));
  if (held.length > 0) {
    return { detail: `the PR is labelled ${held.join(", ")}`, outcome: "held" };
  }
  return null;
}

/**
 * The changed files in frozen folders (aidlc-docs/).
 * @param {string[]} files paths the PR changes
 */
export function frozenFiles(files) {
  return files.filter((f) => f.startsWith("aidlc-docs/"));
}

/**
 * The 1-based line of BACKLOG.md's history heading, if it has one.
 * @param {string} backlog the file's text
 * @returns {number | undefined}
 */
export function historyStartLine(backlog) {
  const index = backlog
    .split("\n")
    .findIndex((line) => line.trim() === BACKLOG_HISTORY_HEADING);
  return index === -1 ? undefined : index + 1;
}

/**
 * Does a `git diff -U0` of BACKLOG.md change anything from the history
 * heading on? Hunks are read on the old side, the merge base's file.
 * @param {string} diff the diff text
 * @param {number} startLine the heading's line in the old file
 */
export function touchesBacklogHistory(diff, startLine) {
  for (const match of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    // A pure insertion (count 0) goes after line `start`; anything else
    // changes lines start..start+count-1
    const last = count === 0 ? start : start + count - 1;
    if (last >= startLine) return true;
  }
  return false;
}

/**
 * Do two package-lock.json texts pin the same packages? npm install adds
 * or drops `"libc"` lists depending on the platform; those don't count.
 * @param {string} a
 * @param {string} b
 */
export function sameLockfile(a, b) {
  const pins = (/** @type {string} */ text) =>
    text.replaceAll(/\n\s*"libc": \[[^\]]*\],?/g, "");
  return pins(a) === pins(b);
}

/**
 * The run and job IDs in a check's link.
 * @param {string | undefined} link
 *   e.g. https://github.com/o/r/actions/runs/123/job/456
 * @returns {{ runId?: string, jobId?: string }}
 */
export function idsFromLink(link) {
  const match = /\/actions\/runs\/(\d+)\/job\/(\d+)/.exec(link ?? "");
  return match ? { jobId: match[2], runId: match[1] } : {};
}

/**
 * Did the job fail because no runner ever picked it up? Then nothing of
 * the PR's ran, and a rerun is fair.
 * @param {{ steps?: { conclusion?: string | null }[] } | undefined} job
 *   the job, from the Actions API
 * @param {{ message?: string }[]} annotations its check run's annotations
 */
export function runnerNeverAcquired(job, annotations) {
  if (
    annotations.some((a) => /not acquired by Runner/i.test(a.message ?? ""))
  ) {
    return true;
  }
  const steps = job?.steps ?? [];
  return !steps.some(
    (s) => s.conclusion === "success" || s.conclusion === "failure",
  );
}

/**
 * @typedef {object} Check
 * @property {string} name
 * @property {string} bucket gh's pass, fail, pending, skipping or cancel
 * @property {string} [workflow]
 * @property {string} [runId]
 * @property {string} [jobId]
 * @property {boolean} [runnerLost] no runner ever picked the job up
 */

/**
 * @typedef {object} Snapshot
 * @property {string} state
 * @property {string} mergeStateStatus
 * @property {Check[]} checks
 * @property {{ code: number, head: boolean }} sonar sonar:pr's exit code
 *   for the latest analysis, and whether it's of the PR's head
 */

/**
 * @typedef {object} Memory
 * @property {boolean} armed auto-merge is on
 * @property {number} cleanPolls polls in a row that saw CLEAN
 * @property {string[]} rerunWorkflows workflows already rerun once
 * @property {string[]} rerunJobs failed jobs a rerun replaces
 */

/**
 * @typedef {{ action: "merged" }
 *   | { action: "stop", outcome: Outcome, detail: string }
 *   | { action: "rerun", runIds: string[], jobIds: string[], workflows: string[] }
 *   | { action: "rebase" }
 *   | { action: "arm" }
 *   | { action: "merge" }
 *   | { action: "wait", reason: string }} Decision
 */

/**
 * The failed checks that may be rerun: every failure in their run is a
 * runner that was never acquired, or the run's aggregate `*-check` job
 * that failed because of it, and the workflow hasn't been rerun yet.
 * Everything else is a real failure.
 * @param {Check[]} failed
 * @param {string[]} rerunWorkflows
 * @returns {{ rerunnable: Check[], real: Check[] }}
 */
export function splitFailures(failed, rerunWorkflows) {
  /** @type {Map<string, Check[]>} */
  const byRun = new Map();
  for (const check of failed) {
    const key = check.runId ?? `no-run:${check.name}`;
    byRun.set(key, [...(byRun.get(key) ?? []), check]);
  }
  /** @type {Check[]} */
  const rerunnable = [];
  /** @type {Check[]} */
  const real = [];
  for (const checks of byRun.values()) {
    const lost = checks.some((c) => c.runnerLost);
    const onlyLost = checks.every(
      (c) => c.runnerLost || c.name.endsWith("-check"),
    );
    const fresh = checks.every(
      (c) => !rerunWorkflows.includes(c.workflow ?? c.name),
    );
    (lost && onlyLost && fresh && checks[0].runId ? rerunnable : real).push(
      ...checks,
    );
  }
  return { real, rerunnable };
}

/**
 * How many polls in a row have seen CLEAN, counting this one.
 * @param {string} mergeStateStatus
 * @param {number} previous
 */
export function nextCleanPolls(mergeStateStatus, previous) {
  return ["CLEAN", "HAS_HOOKS"].includes(mergeStateStatus) ? previous + 1 : 0;
}

/**
 * What to do after one poll of the PR.
 * @param {Snapshot} snapshot
 * @param {Memory} memory
 * @returns {Decision}
 */
export function decide(snapshot, memory) {
  const { checks, mergeStateStatus, sonar, state } = snapshot;
  if (state === "MERGED") return { action: "merged" };
  if (state !== "OPEN") {
    return {
      action: "stop",
      detail: `the PR is ${state.toLowerCase()}`,
      outcome: "not-open",
    };
  }
  // Only the head's analysis counts here; an older one was the early exit
  const headClean = sonar.head && sonar.code === 0;
  if (sonar.head && sonar.code === 1) {
    return {
      action: "stop",
      detail: "SonarCloud reports new issues on the head (npm run sonar:pr)",
      outcome: "sonar",
    };
  }

  const failed = checks.filter(
    (c) =>
      (c.bucket === "fail" || c.bucket === "cancel") &&
      !(c.jobId && memory.rerunJobs.includes(c.jobId)),
  );
  if (failed.length > 0) {
    const { real, rerunnable } = splitFailures(failed, memory.rerunWorkflows);
    if (real.length > 0) {
      const names = [...new Set(real.map((c) => c.name))].join(", ");
      return {
        action: "stop",
        detail: `check failed: ${names}`,
        outcome: "check-failed",
      };
    }
    return {
      action: "rerun",
      jobIds: rerunnable.flatMap((c) => (c.jobId ? [c.jobId] : [])),
      runIds: [
        ...new Set(rerunnable.flatMap((c) => (c.runId ? [c.runId] : []))),
      ],
      workflows: [...new Set(rerunnable.map((c) => c.workflow ?? c.name))],
    };
  }

  if (mergeStateStatus === "DIRTY") {
    return {
      action: "stop",
      detail: "GitHub reports a conflict with main",
      outcome: "conflict",
    };
  }
  if (mergeStateStatus === "BEHIND") return { action: "rebase" };
  if (!headClean) {
    return {
      action: "wait",
      reason: "waiting for SonarCloud to analyze the head before arming",
    };
  }
  if (memory.cleanPolls >= 2) return { action: "merge" };
  if (!memory.armed) return { action: "arm" };
  return {
    action: "wait",
    reason: `merge state ${mergeStateStatus || "UNKNOWN"}`,
  };
}

/**
 * The one-line result, for the shepherd to read.
 * @param {Outcome} outcome
 * @param {string} pr
 * @param {string} detail
 */
export function formatResult(outcome, pr, detail) {
  return `ship-pr result=${outcome} pr=${pr} code=${OUTCOMES[outcome]} detail=${JSON.stringify(detail)}`;
}

// ---------------------------------------------------------------------------
// Side effects: git, gh and npm. Not unit-tested; --dry-run exercises the
// read-only half.

class Stop extends Error {
  /**
   * @param {Outcome} outcome
   * @param {string} detail
   */
  constructor(outcome, detail) {
    super(detail);
    this.outcome = outcome;
    this.detail = detail;
  }
}

/**
 * Run a command; the caller decides what a failure means.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string }} [options]
 */
function run(cmd, args, { cwd } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    stdout: (result.stdout ?? "").trim(),
  };
}

/**
 * Run a command that must succeed.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string }} [options]
 */
function must(cmd, args, options) {
  const result = run(cmd, args, options);
  if (!result.ok) {
    throw new Stop(
      "error",
      `${cmd} ${args.join(" ")} failed: ${lastLines(result.output, 3)}`,
    );
  }
  return result.stdout;
}

/**
 * @param {string} text
 * @param {number} count
 */
function lastLines(text, count) {
  return text.split("\n").slice(-count).join(" | ");
}

/** @param {string} message */
function log(message) {
  const time = new Date().toISOString().slice(11, 19);
  console.error(`[${time}] ${message}`);
}

/** @param {string} path */
function gh(path) {
  return JSON.parse(must("gh", ["api", path]));
}

/**
 * @param {string} pr
 * @returns {PullRequest & { headRefOid: string, mergeStateStatus: string, mergedAt: string | null, autoMergeRequest: object | null }}
 */
function viewPullRequest(pr) {
  const fields =
    "state,isDraft,isCrossRepository,baseRefName,headRefName,headRefOid,labels,mergeStateStatus,mergedAt,autoMergeRequest";
  return JSON.parse(must("gh", ["pr", "view", pr, "--json", fields]));
}

/**
 * The PR's checks, with lost runners marked. gh exits non-zero while
 * checks are pending or failing, so its exit code is ignored.
 * @param {string} pr
 * @returns {Check[]}
 */
function readChecks(pr) {
  const result = run("gh", [
    "pr",
    "checks",
    pr,
    "--json",
    "name,bucket,link,workflow",
  ]);
  if (!result.stdout.startsWith("[")) return [];
  /** @type {{ name: string, bucket: string, link: string, workflow: string }[]} */
  const raw = JSON.parse(result.stdout);
  return raw.map((c) => {
    /** @type {Check} */
    const check = {
      bucket: c.bucket,
      name: c.name,
      workflow: c.workflow,
      ...idsFromLink(c.link),
    };
    if ((c.bucket === "fail" || c.bucket === "cancel") && check.jobId) {
      const job = gh(`repos/${REPO}/actions/jobs/${check.jobId}`);
      const annotations = gh(
        `repos/${REPO}/check-runs/${check.jobId}/annotations`,
      );
      check.runnerLost = runnerNeverAcquired(job, annotations);
    }
    return check;
  });
}

/**
 * sonar:pr for the PR: the head's analysis if there is one, else the
 * latest analysis of any commit.
 * @param {string} pr
 * @param {string} headSha
 */
async function readSonar(pr, headSha) {
  const head = await checkPullRequest(pr, { headSha });
  if (head.code !== 2)
    return { code: head.code, head: true, lines: head.lines };
  const any = await checkPullRequest(pr);
  return { code: any.code, head: false, lines: any.lines };
}

/**
 * Stop if the diff touches a frozen path.
 * @param {string} repo
 * @param {string} headSha
 */
function checkFrozen(repo, headSha) {
  const base = must("git", ["merge-base", "origin/main", headSha], {
    cwd: repo,
  });
  const files = must("git", ["diff", "--name-only", base, headSha], {
    cwd: repo,
  })
    .split("\n")
    .filter(Boolean);
  const frozen = frozenFiles(files);
  if (frozen.length > 0) {
    throw new Stop(
      "frozen",
      `the PR changes frozen files: ${frozen.slice(0, 5).join(", ")}`,
    );
  }
  if (files.includes("BACKLOG.md")) {
    const old = run("git", ["show", `${base}:BACKLOG.md`], { cwd: repo });
    const start = old.ok ? historyStartLine(old.stdout) : undefined;
    const diff = must(
      "git",
      ["diff", "-U0", base, headSha, "--", "BACKLOG.md"],
      { cwd: repo },
    );
    if (start !== undefined && touchesBacklogHistory(diff, start)) {
      throw new Stop(
        "frozen",
        `the PR edits BACKLOG.md's "${BACKLOG_HISTORY_HEADING.slice(3)}" list`,
      );
    }
  }
}

/**
 * Why the checkout the script runs from can't lend its node_modules, if it
 * can't. That is the shepherd's environment, not the PR: typecheck would
 * only say `tsc: command not found`.
 * @param {string} repo the checkout the script runs from
 * @returns {string | null}
 */
export function nodeModulesProblem(repo) {
  if (existsSync(path.join(repo, "node_modules"))) return null;
  return `node_modules is missing from ${repo}, the checkout ship-pr runs from; run npm install there, then run again`;
}

/**
 * Remove the scratch tree's node_modules if it is a link. Only the link
 * goes, never what it points at (the source checkout's node_modules); a
 * real folder is left for the caller.
 * @param {string} scratch
 * @returns {boolean} whether a link was removed
 */
export function unlinkNodeModules(scratch) {
  const target = path.join(scratch, "node_modules");
  try {
    if (!lstatSync(target).isSymbolicLink()) return false;
  } catch {
    return false;
  }
  unlinkSync(target);
  return true;
}

/**
 * Link the source checkout's node_modules into the scratch tree. Safe to
 * repeat: a link that already points there stays, a stale link (it points
 * elsewhere) is replaced, and so is a real folder an earlier install left.
 * The source's node_modules is never touched.
 * @param {string} source the checkout the script runs from
 * @param {string} scratch the scratch worktree
 * @returns {"linked" | "kept" | "replaced"}
 */
export function linkNodeModules(source, scratch) {
  const wanted = path.resolve(source, "node_modules");
  const target = path.join(scratch, "node_modules");
  /** @type {import("node:fs").Stats | undefined} */
  let existing;
  try {
    existing = lstatSync(target);
  } catch {
    // Nothing there yet
  }
  if (existing?.isSymbolicLink()) {
    const current = path.resolve(scratch, readlinkSync(target));
    if (current === wanted) return "kept";
    unlinkNodeModules(scratch);
  } else if (existing) {
    // A real folder, so it is the scratch tree's own: safe to delete
    rmSync(target, { force: true, recursive: true });
  }
  symlinkSync(wanted, target, "dir");
  return existing ? "replaced" : "linked";
}

/**
 * Give the scratch tree node_modules for the typecheck: a link to this
 * checkout's when the lockfiles match, else a clean install.
 * @param {string} repo
 * @param {string} scratch
 */
function provideNodeModules(repo, scratch) {
  const lock = (/** @type {string} */ dir) => {
    try {
      return readFileSync(path.join(dir, "package-lock.json"), "utf8");
    } catch {
      return "";
    }
  };
  if (lock(repo) && sameLockfile(lock(repo), lock(scratch))) {
    const problem = nodeModulesProblem(repo);
    if (problem) throw new Stop("env", problem);
    linkNodeModules(repo, scratch);
    return;
  }
  log("Lockfile differs from this checkout's: npm ci for the typecheck");
  // A link left by an earlier rebase must go first, or npm ci would
  // clear out the checkout's node_modules behind it
  unlinkNodeModules(scratch);
  const install = run(
    "npm",
    ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: scratch },
  );
  if (!install.ok) {
    throw new Stop("error", `npm ci failed: ${lastLines(install.output, 3)}`);
  }
}

/**
 * Rebase the scratch tree onto origin/main, typecheck it and push it, with
 * the lease pinned to the head it started from. Returns the new head.
 * @param {{ repo: string, scratch: string, branch: string, expectedHead: string }} context
 */
function rebaseAndPush({ branch, expectedHead, repo, scratch }) {
  if (branch === "main") throw new Stop("error", "refusing to push to main");
  must("git", ["fetch", "-q", "origin", "main"], { cwd: scratch });
  const rebase = run("git", ["rebase", "origin/main"], { cwd: scratch });
  if (!rebase.ok) {
    run("git", ["rebase", "--abort"], { cwd: scratch });
    throw new Stop(
      "conflict",
      `rebase onto origin/main conflicts: ${lastLines(rebase.output, 2)}`,
    );
  }
  const head = must("git", ["rev-parse", "HEAD"], { cwd: scratch });
  if (head === expectedHead) {
    log("Already on top of origin/main: nothing to push");
    return head;
  }
  log("Rebased; running npm run typecheck on the rebased tree");
  provideNodeModules(repo, scratch);
  const typecheck = run("npm", ["run", "typecheck"], { cwd: scratch });
  if (!typecheck.ok) {
    console.error(lastLines(typecheck.output, 20).split(" | ").join("\n"));
    throw new Stop("typecheck", "npm run typecheck fails on the rebased tree");
  }
  const push = run(
    "git",
    [
      "push",
      "-q",
      `--force-with-lease=refs/heads/${branch}:${expectedHead}`,
      "origin",
      `HEAD:refs/heads/${branch}`,
    ],
    { cwd: scratch },
  );
  if (!push.ok) {
    throw new Stop(
      "branch-moved",
      `push rejected (someone else pushed ${branch}?): ${lastLines(push.output, 2)}`,
    );
  }
  log(`Pushed ${head.slice(0, 8)} to ${branch}`);
  return head;
}

/** @param {number} seconds */
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * @param {Options} options
 * @returns {Promise<{ outcome: Outcome, detail: string }>}
 */
async function ship(options) {
  const { pr } = options;
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const view = viewPullRequest(pr);
  if (view.state === "MERGED") {
    return { detail: `already merged at ${view.mergedAt}`, outcome: "merged" };
  }
  const problem = pullRequestProblem(view);
  if (problem) throw new Stop(problem.outcome, problem.detail);
  const branch = view.headRefName;

  must(
    "git",
    [
      "fetch",
      "-q",
      "origin",
      "main",
      `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
    ],
    { cwd: repo },
  );
  const fetched = must("git", ["rev-parse", `refs/remotes/origin/${branch}`], {
    cwd: repo,
  });
  if (fetched !== view.headRefOid) {
    throw new Stop(
      "branch-moved",
      `${branch} moved while reading it; run again`,
    );
  }
  let head = view.headRefOid;
  log(`PR #${pr}: ${branch} at ${head.slice(0, 8)}, ${view.mergeStateStatus}`);

  checkFrozen(repo, head);
  let sonar = await readSonar(pr, head);
  if (sonar.code === 1) {
    for (const line of sonar.lines) console.error(line);
    throw new Stop("sonar", "SonarCloud reports new issues (npm run sonar:pr)");
  }
  log(
    sonar.code === 0
      ? "SonarCloud: 0 new issues"
      : "SonarCloud hasn't analyzed the PR yet",
  );

  if (options.dryRun) {
    const merge = run(
      "git",
      ["merge-tree", "--write-tree", "origin/main", head],
      { cwd: repo },
    );
    if (!merge.ok)
      throw new Stop(
        "conflict",
        "the PR would conflict with origin/main (git merge-tree)",
      );
    const steps = [
      `create a scratch worktree at ${head.slice(0, 8)}`,
      "rebase onto origin/main (merge-tree predicts no conflict), npm run typecheck",
      `push with --force-with-lease=refs/heads/${branch}:${head.slice(0, 8)}`,
      "arm gh pr merge --auto --rebase once SonarCloud reports 0 new issues on the pushed head",
      `poll every ${options.pollSeconds}s, up to ${options.maxPolls} times, until merged`,
    ];
    for (const step of steps) log(`would ${step}`);
    return {
      detail: `would ship ${branch}; ${steps.length} steps`,
      outcome: "dry-run",
    };
  }

  const scratch = mkdtempSync(path.join(tmpdir(), `romper-ship-${pr}-`));
  must("git", ["worktree", "add", "-q", "--detach", scratch, head], {
    cwd: repo,
  });
  const cleanup = () => {
    // Unlink the borrowed node_modules first, so nothing follows the link
    // (a real folder from npm ci is removed with the scratch tree)
    unlinkNodeModules(scratch);
    run("git", ["worktree", "remove", "--force", scratch], { cwd: repo });
    rmSync(scratch, { force: true, recursive: true });
  };
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  /** @type {Memory} */
  const memory = {
    armed: false,
    cleanPolls: 0,
    rerunJobs: [],
    rerunWorkflows: [],
  };
  const disarm = () => {
    if (run("gh", ["pr", "merge", pr, "--disable-auto"]).ok) {
      log("Auto-merge off until SonarCloud analyzes the head");
    }
    memory.armed = false;
  };
  const arm = () => {
    const armed = run("gh", ["pr", "merge", pr, "--auto", "--rebase"]);
    memory.armed = armed.ok;
    log(
      armed.ok
        ? "Auto-merge armed (rebase)"
        : `Couldn't arm auto-merge: ${lastLines(armed.output, 1)}`,
    );
  };

  try {
    // Auto-merge armed earlier (by the author, or a previous run) could
    // merge the rebased head before SonarCloud has looked at it
    if (view.autoMergeRequest) disarm();
    head = rebaseAndPush({ branch, expectedHead: head, repo, scratch });

    let errorsInARow = 0;
    for (let poll = 1; poll <= options.maxPolls; poll++) {
      await sleep(options.pollSeconds);
      try {
        const now = viewPullRequest(pr);
        if (now.state === "OPEN" && now.headRefOid !== head) {
          throw new Stop(
            "branch-moved",
            `${branch} moved to ${now.headRefOid.slice(0, 8)} while shipping`,
          );
        }
        sonar = await readSonar(pr, head);
        memory.cleanPolls = nextCleanPolls(
          now.mergeStateStatus,
          memory.cleanPolls,
        );
        const decision = decide(
          {
            checks: readChecks(pr),
            mergeStateStatus: now.mergeStateStatus,
            sonar,
            state: now.state,
          },
          memory,
        );
        switch (decision.action) {
          case "merged": {
            const merged = viewPullRequest(pr);
            return {
              detail: `merged at ${merged.mergedAt}`,
              outcome: "merged",
            };
          }
          case "stop":
            if (decision.outcome === "sonar")
              for (const line of sonar.lines) console.error(line);
            throw new Stop(decision.outcome, decision.detail);
          case "rerun":
            for (const runId of decision.runIds) {
              log(
                `No runner ever picked up a job in run ${runId}: rerunning its failed jobs once`,
              );
              must("gh", [
                "api",
                "-X",
                "POST",
                `repos/${REPO}/actions/runs/${runId}/rerun-failed-jobs`,
              ]);
            }
            memory.rerunJobs.push(...decision.jobIds);
            memory.rerunWorkflows.push(...decision.workflows);
            break;
          case "rebase":
            log("Behind main: rebasing again");
            if (memory.armed) disarm();
            head = rebaseAndPush({ branch, expectedHead: head, repo, scratch });
            memory.cleanPolls = 0;
            break;
          case "arm":
            arm();
            break;
          case "merge": {
            log("Green but auto-merge hasn't fired: merging directly (rebase)");
            const merge = run("gh", ["pr", "merge", pr, "--rebase"]);
            if (!merge.ok)
              log(`Direct merge refused: ${lastLines(merge.output, 1)}`);
            break;
          }
          case "wait":
            log(`Poll ${poll}/${options.maxPolls}: ${decision.reason}`);
            break;
        }
        errorsInARow = 0;
      } catch (error) {
        // A network blip in a long watch isn't a reason to stop: retry a
        // failed git, gh or SonarCloud call twice before giving up
        if (error instanceof Stop && error.outcome !== "error") throw error;
        if (++errorsInARow >= 3) throw error;
        log(
          `Poll ${poll}: ${error instanceof Error ? error.message : error}; retrying`,
        );
      }
    }
    throw new Stop("timeout", `not merged after ${options.maxPolls} polls`);
  } catch (error) {
    if (memory.armed) {
      // Nothing merges unattended after the shepherd has stopped
      run("gh", ["pr", "merge", pr, "--disable-auto"]);
    }
    throw error;
  } finally {
    cleanup();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = parseArgs(process.argv.slice(2));
  if ("error" in options) {
    console.error(options.error);
    console.error(
      "Usage: npm run ship -- <pr-number> [--dry-run] [--poll-seconds N] [--max-polls N]",
    );
    console.log(formatResult("usage", "?", options.error));
    process.exit(OUTCOMES.usage);
  }
  /** @type {{ outcome: Outcome, detail: string }} */
  let result;
  try {
    result = await ship(options);
  } catch (error) {
    result =
      error instanceof Stop
        ? { detail: error.detail, outcome: error.outcome }
        : {
            detail: error instanceof Error ? error.message : String(error),
            outcome: "error",
          };
  }
  console.log(formatResult(result.outcome, options.pr, result.detail));
  process.exit(OUTCOMES[result.outcome]);
}

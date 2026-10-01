#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import { getMainRoot, listWorktrees } from "./worktree-paths.js";

function runCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.silent) {
      console.error(`❌ Command failed: ${command}`);
      console.error(error.message);
    }
    throw error;
  }
}

// A ref is merged when every commit on it already has an equivalent on
// origin/main. `git cherry` compares patches, so it also recognizes rebase
// merges, which `git branch --merged` misses (rebasing rewrites the SHAs).
// GitHub's rebase can still change a patch (its context moved on main), so
// a branch whose tip is the head of a merged PR also counts as merged.
function isMerged(ref, branchName, cwd) {
  try {
    runCommand("git fetch origin --quiet", { cwd, silent: true });
    const out = runCommand(`git cherry origin/main ${ref}`, {
      cwd,
      silent: true,
    });
    if (!out.split("\n").some((line) => line.startsWith("+"))) return true;
  } catch {
    return false;
  }
  return branchName ? isMergedPrHead(ref, branchName, cwd) : false;
}

function isMergedPrHead(ref, branchName, cwd) {
  try {
    const tip = runCommand(`git rev-parse ${ref}`, {
      cwd,
      silent: true,
    }).trim();
    const heads = runCommand(
      `gh pr list --head ${branchName} --state merged --json headRefOid --jq ".[].headRefOid"`,
      { cwd, silent: true },
    );
    return heads.split("\n").includes(tip);
  } catch {
    return false; // no gh, not signed in, or offline
  }
}

// Find the worktree by its folder name, which worktree:create sets to the
// task name and which survives renaming the branch (e.g. to fix/...). Fall
// back to the feature/<task-name> branch for worktrees whose folder differs.
// The main checkout is never a candidate.
function findWorktree(mainRoot, taskName) {
  const worktrees = listWorktrees(mainRoot).filter(
    (wt) => path.resolve(wt.path) !== path.resolve(mainRoot),
  );
  const byPath = worktrees.filter((wt) => path.basename(wt.path) === taskName);
  if (byPath.length > 0) return byPath;
  return worktrees.filter((wt) => wt.branch === `feature/${taskName}`);
}

function main() {
  const taskName = process.argv[2];
  const force = process.argv.includes("--force") || process.argv.includes("-f");

  if (!taskName || taskName.startsWith("-")) {
    console.error("Task name required");
    console.error("Usage: npm run worktree:remove <task-name> [--force]");
    console.error(
      "Finds the worktree whose folder is <task-name>, or else the one on feature/<task-name>.",
    );
    console.error("List worktrees with: npm run worktree:list");
    process.exit(1);
  }

  const mainRoot = getMainRoot();

  const matches = findWorktree(mainRoot, taskName);
  if (matches.length === 0) {
    console.error(
      `No worktree is in a folder named ${taskName} or checked out on feature/${taskName}.`,
    );
    runCommand("git worktree list", { cwd: mainRoot });
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`More than one worktree matches ${taskName}:`);
    for (const wt of matches) console.error(`  ${wt.path}`);
    console.error("Remove the right one with: git worktree remove <path>");
    process.exit(1);
  }

  const [worktree] = matches;
  const branchName = worktree.branch; // undefined for a detached HEAD
  const label = branchName ?? `detached HEAD ${worktree.head.slice(0, 8)}`;

  if (!force && !isMerged(branchName ?? worktree.head, branchName, mainRoot)) {
    console.error(`${label} has commits that aren't on origin/main.`);
    console.error(
      `Merge it first, or remove anyway: npm run worktree:remove ${taskName} --force`,
    );
    process.exit(1);
  }

  try {
    console.log(`Removing worktree ${worktree.path} (${label})`);
    runCommand(
      `git worktree remove "${worktree.path}"${force ? " --force" : ""}`,
      {
        cwd: mainRoot,
      },
    );
    if (branchName) {
      runCommand(`git branch -D ${branchName}`, {
        cwd: mainRoot,
        silent: true,
      });
    }
    runCommand("git worktree prune", { cwd: mainRoot, silent: true });
    console.log(
      branchName
        ? `Removed ${worktree.path} and deleted ${branchName}.`
        : `Removed ${worktree.path}.`,
    );
  } catch {
    console.error(
      "Failed to remove the worktree. It may have uncommitted changes;",
    );
    console.error(`inspect it, then retry with --force.`);
    process.exit(1);
  }
}

main();

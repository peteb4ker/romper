#!/usr/bin/env node

import { execSync } from "child_process";
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

// A branch is merged when every commit on it already has an equivalent on
// origin/main. `git cherry` compares patches, so it also recognizes rebase
// merges, which `git branch --merged` misses (rebasing rewrites the SHAs).
function isMerged(branchName, cwd) {
  try {
    runCommand("git fetch origin --quiet", { cwd, silent: true });
    const out = runCommand(`git cherry origin/main ${branchName}`, {
      cwd,
      silent: true,
    });
    return !out.split("\n").some((line) => line.startsWith("+"));
  } catch {
    return false;
  }
}

function main() {
  const taskName = process.argv[2];
  const force = process.argv.includes("--force") || process.argv.includes("-f");

  if (!taskName || taskName.startsWith("-")) {
    console.error("Task name required");
    console.error("Usage: npm run worktree:remove <task-name> [--force]");
    console.error("List worktrees with: npm run worktree:list");
    process.exit(1);
  }

  const mainRoot = getMainRoot();
  const branchName = `feature/${taskName}`;

  // Look the worktree up by branch so this works wherever it lives (the
  // sibling worktrees dir, or the legacy in-repo worktrees/ dir).
  const worktree = listWorktrees(mainRoot).find(
    (wt) => wt.branch === branchName,
  );
  if (!worktree) {
    console.error(`No worktree is checked out on ${branchName}.`);
    runCommand("git worktree list", { cwd: mainRoot });
    process.exit(1);
  }

  if (!force && !isMerged(branchName, mainRoot)) {
    console.error(`${branchName} has commits that aren't on origin/main.`);
    console.error(
      `Merge it first, or remove anyway: npm run worktree:remove ${taskName} --force`,
    );
    process.exit(1);
  }

  try {
    console.log(`Removing worktree ${worktree.path}`);
    runCommand(
      `git worktree remove "${worktree.path}"${force ? " --force" : ""}`,
      {
        cwd: mainRoot,
      },
    );
    runCommand(`git branch -D ${branchName}`, { cwd: mainRoot, silent: true });
    runCommand("git worktree prune", { cwd: mainRoot, silent: true });
    console.log(`Removed ${worktree.path} and deleted ${branchName}.`);
  } catch {
    console.error(
      "Failed to remove the worktree. It may have uncommitted changes;",
    );
    console.error(`inspect it, then retry with --force.`);
    process.exit(1);
  }
}

main();

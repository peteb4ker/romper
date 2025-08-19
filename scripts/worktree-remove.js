#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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

function main() {
  const taskName = process.argv[2];

  if (!taskName) {
    console.error("❌ Task name required");
    console.error("Usage: npm run worktree:remove <task-name>");
    console.error("");
    console.error("List available worktrees with:");
    console.error("  npm run worktree:list");
    process.exit(1);
  }

  console.log(`🗑️  Removing worktree: ${taskName}`);

  const worktreePath = path.join(process.cwd(), "worktrees", taskName);
  const branchName = `feature/${taskName}`;

  // Check if worktree exists
  if (!fs.existsSync(worktreePath)) {
    console.error(`❌ Worktree not found: ${worktreePath}`);
    console.error("Available worktrees:");
    try {
      runCommand("npm run worktree:list");
    } catch {
      console.error("No worktrees found");
    }
    process.exit(1);
  }

  // Check if branch has been merged or if user wants to force remove
  const force = process.argv.includes("--force") || process.argv.includes("-f");

  if (!force) {
    try {
      // Check if branch has unmerged changes
      const _result = runCommand(
        `git branch --no-merged main | grep -q ${branchName}`,
        { silent: true },
      );
      console.log("⚠️  Warning: Branch has unmerged changes!");
      console.log("If you are sure you want to remove it, use:");
      console.log(`  npm run worktree:remove ${taskName} --force`);
      console.log("");
      console.log("Or merge/PR the branch first, then remove the worktree.");
      process.exit(1);
    } catch {
      // Branch is merged or doesn't exist, safe to remove
    }
  }

  try {
    console.log(`📁 Removing worktree directory: ${worktreePath}`);
    runCommand(`git worktree remove ${worktreePath}`);

    // Try to delete the branch if it exists
    try {
      console.log(`🌿 Deleting branch: ${branchName}`);
      runCommand(`git branch -D ${branchName}`, { silent: true });
    } catch {
      // Branch might not exist or might be protected, that's okay
      console.log(
        `ℹ️  Branch ${branchName} not deleted (might not exist or be protected)`,
      );
    }

    // Clean up any orphaned worktree references
    try {
      runCommand("git worktree prune", { silent: true });
    } catch {
      // Ignore prune errors
    }

    console.log("✅ Worktree removed successfully!");
  } catch {
    console.error("❌ Failed to remove worktree");
    console.error("You may need to force remove with:");
    console.error(`  git worktree remove --force ${worktreePath}`);
    console.error(`  git branch -D ${branchName}`);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

import { execSync } from "child_process";
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
  console.log("📍 Current Worktree Information");
  console.log("================================");

  try {
    // Get current directory
    const currentDir = process.cwd();
    console.log(`📁 Directory: ${currentDir}`);

    // Get current branch
    const currentBranch = runCommand("git branch --show-current", {
      silent: true,
    }).trim();
    console.log(`🌿 Branch: ${currentBranch}`);

    // Check if we're in a worktree
    try {
      const _worktreeInfo = runCommand("git rev-parse --show-toplevel", {
        silent: true,
      }).trim();
      const gitCommonDir = runCommand("git rev-parse --git-common-dir", {
        silent: true,
      }).trim();

      if (gitCommonDir !== ".git") {
        console.log("📦 Status: In worktree");

        // Determine worktree name from path
        const worktreeName = path.basename(currentDir);
        console.log(`🏷️  Worktree: ${worktreeName}`);
      } else {
        console.log("📦 Status: Main repository");
      }
    } catch (_error) {
      console.log("📦 Status: Unknown");
    }

    // Show git status
    console.log("");
    console.log("Git Status:");
    console.log("-----------");
    try {
      runCommand("git status --porcelain", { silent: false });
    } catch (_error) {
      console.log("No git status available");
    }

    // Show all worktrees
    console.log("");
    console.log("All Worktrees:");
    console.log("--------------");
    try {
      runCommand("git worktree list");
    } catch (_error) {
      console.log("No worktrees found");
    }
  } catch (_error) {
    console.error("❌ Failed to get worktree information");
    process.exit(1);
  }
}

main();

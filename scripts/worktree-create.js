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
    console.error("Usage: npm run worktree:create <task-name>");
    console.error("");
    console.error("Examples:");
    console.error("  npm run worktree:create task-5.2-kit-editor");
    console.error("  npm run worktree:create fix-sample-loading");
    console.error("  npm run worktree:create docs-update");
    process.exit(1);
  }

  // Validate task name (no spaces, reasonable characters)
  if (!/^[a-zA-Z0-9._-]+$/.test(taskName)) {
    console.error(
      "❌ Invalid task name. Use only letters, numbers, dots, hyphens, and underscores."
    );
    process.exit(1);
  }

  console.log(`🚀 Creating worktree for: ${taskName}`);

  // Ensure worktrees directory exists
  const worktreesDir = path.join(process.cwd(), "worktrees");
  if (!fs.existsSync(worktreesDir)) {
    console.log("📁 Creating worktrees directory...");
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  const worktreePath = path.join(worktreesDir, taskName);
  const branchName = `feature/${taskName}`;

  // Check if worktree already exists
  if (fs.existsSync(worktreePath)) {
    console.error(`❌ Worktree already exists at: ${worktreePath}`);
    process.exit(1);
  }

  // Check if branch already exists
  try {
    runCommand(`git rev-parse --verify ${branchName}`, { silent: true });
    console.error(`❌ Branch ${branchName} already exists`);
    console.error(
      "Use: npm run worktree:remove to clean up, or choose a different task name"
    );
    process.exit(1);
  } catch {
    // Branch doesn't exist, which is what we want
  }

  console.log(`🌿 Creating branch: ${branchName}`);
  console.log(`📁 Creating worktree: ${worktreePath}`);

  try {
    // Create worktree with new branch
    runCommand(`git worktree add ${worktreePath} -b ${branchName}`);

    console.log("✅ Worktree created successfully!");
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${worktreePath}`);
    console.log("  npm install  # Install dependencies");
    console.log("  # Make your changes");
    console.log('  npm run commit "your commit message"');
    console.log("");
    console.log("When done:");
    console.log(`  cd ${process.cwd()}`);
    console.log(`  npm run worktree:remove ${taskName}`);
  } catch {
    console.error("❌ Failed to create worktree");
    process.exit(1);
  }
}

main();

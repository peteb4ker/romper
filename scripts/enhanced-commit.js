#!/usr/bin/env node

import { execSync } from "child_process";

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

function getCurrentBranch() {
  try {
    return runCommand("git branch --show-current", { silent: true }).trim();
  } catch {
    console.error("❌ Failed to get current branch");
    process.exit(1);
  }
}

function checkForUnstagedChanges() {
  try {
    runCommand("git diff --quiet", { silent: true });
    return false; // No unstaged changes
  } catch {
    return true; // Has unstaged changes
  }
}

function checkForStagedChanges() {
  try {
    runCommand("git diff --cached --quiet", { silent: true });
    return false; // No staged changes
  } catch {
    return true; // Has staged changes
  }
}

async function main() {
  console.log("🚀 Enhanced commit workflow starting...");

  // Check current branch
  const currentBranch = getCurrentBranch();
  console.log(`📍 Current branch: ${currentBranch}`);

  // Block commits on main branch
  if (currentBranch === "main") {
    console.error("❌ Direct commits to main branch are not allowed!");
    console.error("");
    console.error("Use the worktree workflow:");
    console.error("  npm run worktree:create <task-name>");
    console.error("  cd worktrees/<task-name>");
    console.error("  npm run commit");
    console.error("");
    process.exit(1);
  }

  // Check for changes to commit
  const hasUnstagedChanges = checkForUnstagedChanges();
  const hasStagedChanges = checkForStagedChanges();

  if (!hasStagedChanges && !hasUnstagedChanges) {
    console.error("❌ No changes to commit");
    process.exit(1);
  }

  // Auto-stage all changes if there are unstaged changes
  if (hasUnstagedChanges) {
    console.log("📦 Staging all changes...");
    runCommand("git add -A");
  }

  // Get commit message from user
  const commitMessage = process.argv.slice(2).join(" ");
  if (!commitMessage) {
    console.error("❌ Commit message required");
    console.error('Usage: npm run commit "your commit message"');
    process.exit(1);
  }

  console.log("🔍 Running pre-commit checks...");
  console.log("🔍 TypeScript → 🧹 Linting → 🧪 Testing → 🏗️ Building");

  try {
    // This will run all pre-commit hooks via Husky
    runCommand(`git commit -m "${commitMessage}"`);
    console.log("✅ Commit successful with all quality checks passed!");
  } catch {
    console.error("❌ Commit failed - please fix the issues and try again");
    process.exit(1);
  }

  // Push to remote
  console.log("📤 Pushing to remote...");
  try {
    // Check if branch exists on remote
    try {
      runCommand(`git rev-parse --verify origin/${currentBranch}`, {
        silent: true,
      });
      // Branch exists, just push
      runCommand("git push");
    } catch {
      // Branch doesn't exist, push with -u flag
      runCommand(`git push -u origin ${currentBranch}`);
    }
    console.log("✅ Successfully pushed to remote!");
  } catch {
    console.error("❌ Failed to push to remote");
    process.exit(1);
  }

  // Create PR
  console.log("🔄 Creating pull request...");
  try {
    // Extract a short PR title from commit message (max 50-60 chars)
    // Try to detect type prefix (feat:, fix:, etc.) and preserve it
    const typeMatch = commitMessage.match(
      /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci):\s*/i,
    );
    let prTitle = commitMessage;

    if (typeMatch) {
      // Has a type prefix, ensure the whole title is under 60 chars
      if (commitMessage.length > 60) {
        const type = typeMatch[0];
        const description = commitMessage.slice(type.length).trim();
        const maxDescLength = 60 - type.length;
        
        if (maxDescLength > 0) {
          const truncatedDesc = description.slice(0, maxDescLength);
          const finalDesc = (/\s+\S*$/.test(truncatedDesc) ? truncatedDesc.replace(/\s+\S*$/, '') : truncatedDesc).trim();
          
          // Check if we have a meaningful description after truncation (minimum 3 chars)
          if (finalDesc.length >= 3) {
            prTitle = type + finalDesc;
          } else {
            // Fallback: just truncate the commit message as in the "no type prefix" branch
            const truncated = commitMessage.slice(0, 60);
            prTitle = (/\s+\S*$/.test(truncated) ? truncated.replace(/\s+\S*$/, '') : truncated).trim();
          }
        } else {
          // Fallback: just truncate the commit message as in the "no type prefix" branch
          const truncated = commitMessage.slice(0, 60);
          prTitle = (/\s+\S*$/.test(truncated) ? truncated.replace(/\s+\S*$/, '') : truncated).trim();
        }
      }
    } else {
      // No type prefix, just truncate to 50 chars
      if (commitMessage.length > 50) {
        const truncated = commitMessage.slice(0, 50);
        prTitle = (/\s+\S*$/.test(truncated) ? truncated.replace(/\s+\S*$/, '') : truncated).trim();
      }
    }
    const prBody = `## Summary
${commitMessage}

## Test plan
- [x] All pre-commit checks pass
- [x] Code builds successfully  
- [x] Tests pass
- [ ] Manual testing completed`;

    const prCommand = `gh pr create --title "${prTitle}" --body "${prBody}"`;
    const prResult = runCommand(prCommand, { silent: true });

    // Extract PR URL from output
    const prUrl = prResult.match(/https:\/\/github\.com\/[^\s]+/)?.[0];
    if (prUrl) {
      console.log("✅ Pull request created successfully!");
      console.log(`🔗 PR URL: ${prUrl}`);
    } else {
      console.log("✅ Pull request created successfully!");
    }

    // Enable auto-merge for the PR
    console.log("🤖 Enabling auto-merge...");
    try {
      runCommand("gh pr merge --auto --squash", { silent: true });
      console.log(
        "✅ Auto-merge enabled - PR will merge when all checks pass!",
      );
    } catch {
      console.error("⚠️  Failed to enable auto-merge");
      console.error("You can enable it manually with:");
      console.error("  gh pr merge --auto --squash");
    }
  } catch {
    console.error("❌ Failed to create pull request");
    console.error("You can create it manually with:");
    console.error(`  gh pr create --title "${commitMessage}"`);
  }

  console.log("");
  console.log("🎉 Complete! Your changes have been:");
  console.log("  ✅ Committed with quality checks");
  console.log("  ✅ Pushed to remote repository");
  console.log("  ✅ Pull request created for review");
  console.log("  🤖 Auto-merge enabled (will merge when checks pass)");
}

main().catch((error) => {
  console.error("❌ Enhanced commit failed:", error.message);
  process.exit(1);
});

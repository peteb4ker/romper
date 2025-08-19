#!/usr/bin/env node

/**
 * Git operations utility module
 * Handles all git-related operations for the release process
 */

import { execSync } from "child_process";
import chalk from "chalk";

/**
 * Execute a git command
 */
function execGit(command, options = {}) {
  try {
    const result = execSync(`git ${command}`, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
    return result?.trim();
  } catch (error) {
    throw new Error(`Git command failed: git ${command}\n${error.message}`);
  }
}

/**
 * Get the current branch name
 */
function getCurrentBranch() {
  return execGit("rev-parse --abbrev-ref HEAD", { silent: true });
}

/**
 * Check if the working directory is clean
 */
function isWorkingDirectoryClean() {
  const status = execGit("status --porcelain", { silent: true });
  return status.length === 0;
}

/**
 * Get the latest tag
 */
function getLatestTag() {
  try {
    return execGit("describe --tags --abbrev=0", { silent: true });
  } catch (_error) {
    // No tags exist yet
    return null;
  }
}

/**
 * Get all tags sorted by version
 */
function getAllTags() {
  try {
    const tags = execGit("tag --list --sort=-version:refname", {
      silent: true,
    });
    return tags ? tags.split("\n").filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

/**
 * Get commits since a specific tag
 */
function getCommitsSinceTag(tag) {
  try {
    const range = tag ? `${tag}..HEAD` : "HEAD";
    const commits = execGit(
      `log ${range} --pretty=format:"%H|%s|%an|%ae|%ai"`,
      { silent: true },
    );

    if (!commits) return [];

    return commits.split("\n").map((line) => {
      const [hash, subject, authorName, authorEmail, date] = line.split("|");
      return {
        hash,
        subject,
        authorName,
        authorEmail,
        date: new Date(date),
      };
    });
  } catch (error) {
    console.warn(
      chalk.yellow(
        `Warning: Could not get commits since ${tag}: ${error.message}`,
      ),
    );
    return [];
  }
}

/**
 * Check if a tag exists
 */
function tagExists(tag) {
  try {
    execGit(`rev-parse --verify ${tag}`, { silent: true });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Create a new tag
 */
function createTag(tag, message) {
  if (tagExists(tag)) {
    throw new Error(`Tag ${tag} already exists`);
  }

  execGit(`tag -a ${tag} -m "${message}"`);
  console.log(chalk.green(`✅ Created tag: ${tag}`));
}

/**
 * Push tags to remote
 */
function pushTags() {
  execGit("push origin --tags");
  console.log(chalk.green("✅ Pushed tags to remote"));
}

/**
 * Delete a tag locally and remotely
 */
function deleteTag(tag) {
  try {
    // Delete locally
    execGit(`tag -d ${tag}`);
    console.log(chalk.yellow(`🗑️  Deleted local tag: ${tag}`));

    // Delete remotely
    execGit(`push origin :refs/tags/${tag}`);
    console.log(chalk.yellow(`🗑️  Deleted remote tag: ${tag}`));
  } catch (error) {
    console.warn(
      chalk.yellow(`Warning: Could not delete tag ${tag}: ${error.message}`),
    );
  }
}

/**
 * Check if remote is up to date
 */
function isRemoteUpToDate() {
  try {
    // Fetch latest from remote
    execGit("fetch origin", { silent: true });

    // Check if local and remote are in sync
    const localCommit = execGit("rev-parse HEAD", { silent: true });
    const remoteCommit = execGit("rev-parse origin/main", { silent: true });

    return localCommit === remoteCommit;
  } catch (error) {
    console.warn(
      chalk.yellow(`Warning: Could not check remote status: ${error.message}`),
    );
    return false;
  }
}

/**
 * Get the current commit hash
 */
function getCurrentCommit() {
  return execGit("rev-parse HEAD", { silent: true });
}

/**
 * Get the commit hash for a tag
 */
function getTagCommit(tag) {
  return execGit(`rev-list -n 1 ${tag}`, { silent: true });
}

/**
 * Check if there are unpushed commits
 */
function hasUnpushedCommits() {
  try {
    const unpushed = execGit("log @{u}..HEAD --oneline", { silent: true });
    return unpushed.length > 0;
  } catch (_error) {
    // No upstream branch or other error
    return false;
  }
}

/**
 * Get remote URL
 */
function getRemoteUrl() {
  try {
    return execGit("remote get-url origin", { silent: true });
  } catch (_error) {
    return null;
  }
}

export {
  execGit,
  getCurrentBranch,
  isWorkingDirectoryClean,
  getLatestTag,
  getAllTags,
  getCommitsSinceTag,
  tagExists,
  createTag,
  pushTags,
  deleteTag,
  isRemoteUpToDate,
  getCurrentCommit,
  getTagCommit,
  hasUnpushedCommits,
  getRemoteUrl,
};

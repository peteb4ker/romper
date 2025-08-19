#!/usr/bin/env node

/**
 * Commit parser for release notes generation
 * Parses git commits since last tag and categorizes them for release notes
 */

import { getCommitsSinceTag, getLatestTag } from "./utils/git.js";

// Constants
const SHORT_HASH_LENGTH = 7;

/**
 * Parse conventional commit format
 * Returns { type, scope, subject, breaking, body, footer }
 */
function parseConventionalCommit(subject) {
  // Conventional commit format: type(scope): subject
  const conventionalPattern = /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/;
  const match = subject.match(conventionalPattern);

  if (!match) {
    return {
      type: "other",
      scope: null,
      subject: subject,
      breaking: false,
    };
  }

  const [, type, scope, breakingMark, description] = match;

  return {
    type: type.toLowerCase(),
    scope: scope || null,
    subject: description,
    breaking: breakingMark === "!",
  };
}

/**
 * Extract PR and issue references from commit message
 */
function extractReferences(subject) {
  const prPattern = /#(\d+)/g;
  const issuePattern = /(?:fixes?|closes?|resolves?)\s+#(\d+)/gi;

  const prs = [];
  const issues = [];

  let match;

  // Extract PR references
  while ((match = prPattern.exec(subject)) !== null) {
    prs.push(parseInt(match[1]));
  }

  // Extract issue references
  while ((match = issuePattern.exec(subject)) !== null) {
    issues.push(parseInt(match[1]));
  }

  return { prs, issues };
}

/**
 * Categorize commits by type
 */
function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    performance: [],
    other: [],
  };

  const contributors = new Set();

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    const refs = extractReferences(commit.subject);

    // Add contributor
    contributors.add(commit.authorName);

    const entry = {
      hash: commit.hash.substring(0, SHORT_HASH_LENGTH),
      subject: parsed.subject,
      author: commit.authorName,
      date: commit.date,
      prs: refs.prs,
      issues: refs.issues,
      scope: parsed.scope,
      originalSubject: commit.subject,
    };

    // Categorize based on type and breaking change
    if (parsed.breaking || commit.subject.includes("BREAKING")) {
      categories.breaking.push(entry);
    } else if (parsed.type === "feat") {
      categories.features.push(entry);
    } else if (parsed.type === "fix") {
      categories.fixes.push(entry);
    } else if (parsed.type === "perf") {
      categories.performance.push(entry);
    } else {
      // docs, chore, style, refactor, test, etc.
      categories.other.push(entry);
    }
  }

  return {
    categories,
    contributors: Array.from(contributors).sort(),
  };
}

/**
 * Format commit entry for release notes
 */
function formatCommitEntry(entry) {
  let formatted = entry.subject;

  // Add scope if present
  if (entry.scope) {
    formatted = `**${entry.scope}**: ${formatted}`;
  }

  // Add PR references
  if (entry.prs.length > 0) {
    const prRefs = entry.prs.map((pr) => `#${pr}`).join(", ");
    formatted += ` (${prRefs})`;
  }

  // Add issue references
  if (entry.issues.length > 0) {
    const issueRefs = entry.issues.map((issue) => `fixes #${issue}`).join(", ");
    formatted += ` (${issueRefs})`;
  }

  return formatted;
}

/**
 * Parse commits since last tag and return categorized data
 */
function parseCommitsSinceLastTag() {
  const latestTag = getLatestTag();
  const commits = getCommitsSinceTag(latestTag);

  if (commits.length === 0) {
    return {
      hasChanges: false,
      previousTag: latestTag,
      categories: {
        breaking: [],
        features: [],
        fixes: [],
        performance: [],
        other: [],
      },
      contributors: [],
      formattedCategories: {
        breaking: [],
        features: [],
        fixes: [],
        performance: [],
        other: [],
      },
    };
  }

  const { categories, contributors } = categorizeCommits(commits);

  // Format entries for display
  const formattedCategories = {
    breaking: categories.breaking.map(formatCommitEntry),
    features: categories.features.map(formatCommitEntry),
    fixes: categories.fixes.map(formatCommitEntry),
    performance: categories.performance.map(formatCommitEntry),
    other: categories.other.map(formatCommitEntry),
  };

  return {
    hasChanges: true,
    previousTag: latestTag,
    categories,
    contributors,
    formattedCategories,
    commitCount: commits.length,
  };
}

/**
 * Get summary of changes for user display
 */
function getChangesSummary() {
  const data = parseCommitsSinceLastTag();

  if (!data.hasChanges) {
    return "No changes since last release.";
  }

  const { formattedCategories, commitCount, contributors, previousTag } = data;

  const summary = [];

  if (formattedCategories.breaking.length > 0) {
    summary.push(
      `⚠️  ${formattedCategories.breaking.length} breaking change(s)`
    );
  }

  if (formattedCategories.features.length > 0) {
    summary.push(`✨ ${formattedCategories.features.length} new feature(s)`);
  }

  if (formattedCategories.fixes.length > 0) {
    summary.push(`🐛 ${formattedCategories.fixes.length} bug fix(es)`);
  }

  if (formattedCategories.performance.length > 0) {
    summary.push(
      `⚡ ${formattedCategories.performance.length} performance improvement(s)`
    );
  }

  if (formattedCategories.other.length > 0) {
    summary.push(`🔧 ${formattedCategories.other.length} other change(s)`);
  }

  const contributorText =
    contributors.length === 1
      ? `1 contributor`
      : `${contributors.length} contributors`;

  const sinceText = previousTag ? `since ${previousTag}` : "in this release";

  return `${summary.join(", ")} from ${contributorText} (${commitCount} commits ${sinceText})`;
}

export {
  parseConventionalCommit,
  extractReferences,
  categorizeCommits,
  formatCommitEntry,
  parseCommitsSinceLastTag,
  getChangesSummary,
};

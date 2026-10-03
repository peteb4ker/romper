#!/usr/bin/env node

/**
 * Release notes generator
 * Generates release notes from templates and parsed commit data
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { getFixedIssueGroups, releaseWindow } from "./fixed-issues.js";
import { parseCommitsSinceLastTag } from "./parse-commits.js";
import { getCommitDate, getGitHubRepoSlug } from "./utils/git.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

/**
 * Load and compile a Handlebars template
 */
function loadTemplate(templateName) {
  const templatePath = path.join(
    projectRoot,
    "docs",
    "templates",
    templateName,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, "utf8");
  return Handlebars.compile(templateContent);
}

/**
 * Get platform-specific platform identifier for artifacts
 */
function getPlatformIdentifier() {
  // Return the actual architecture for all platforms
  return process.arch;
}

/**
 * Issues closed as completed between the previous tag's commit and HEAD
 * (the tagged commit in CI), grouped for "Fixed in this release". Null when
 * GitHub can't be queried.
 */
function getFixedIssuesSinceTag(previousTag) {
  const repo = getGitHubRepoSlug();
  if (!repo) {
    console.error(
      'Release notes: leaving out "Fixed in this release" because the GitHub repository is unknown.',
    );
    return null;
  }

  return getFixedIssueGroups(
    repo,
    releaseWindow(
      previousTag ? getCommitDate(previousTag) : null,
      getCommitDate("HEAD"),
    ),
  );
}

/**
 * Generate release notes data object
 *
 * `getFixedIssues(previousTag)` is injectable so tests don't query GitHub.
 */
function generateReleaseData(
  version,
  customData = {},
  { getFixedIssues = getFixedIssuesSinceTag } = {},
) {
  const commitData = parseCommitsSinceLastTag();
  const fixedIssues = getFixedIssues(commitData.previousTag);
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  // Prepare template data
  const data = {
    version,
    date,
    platform: getPlatformIdentifier(),
    previous_version: commitData.previousTag || "initial",

    // Highlights can be customized
    highlights: customData.highlights || null,

    // Issues closed as completed since the previous release, by use case
    fixed_issues: fixedIssues?.length > 0 ? fixedIssues : null,

    // Breaking changes
    breaking:
      commitData.formattedCategories.breaking.length > 0
        ? commitData.formattedCategories.breaking
        : null,

    // Features
    features:
      commitData.formattedCategories.features.length > 0
        ? commitData.formattedCategories.features
        : null,

    // Bug fixes
    fixes:
      commitData.formattedCategories.fixes.length > 0
        ? commitData.formattedCategories.fixes
        : null,

    // Performance improvements
    performance:
      commitData.formattedCategories.performance.length > 0
        ? commitData.formattedCategories.performance
        : null,

    // Other changes
    other:
      commitData.formattedCategories.other.length > 0
        ? commitData.formattedCategories.other
        : null,

    // Contributors
    contributors:
      commitData.contributors.length > 0 ? commitData.contributors : null,

    // Commit count
    commitCount: commitData.commitCount || 0,

    // Known issues (can be customized)
    known_issues: customData.knownIssues || null,

    // Additional custom data
    ...customData,
  };

  return data;
}

/**
 * Render the release notes template with a prepared data object
 */
function renderReleaseNotes(data) {
  return loadTemplate("RELEASE_NOTES_TEMPLATE.md")(data);
}

/**
 * Generate release notes from template
 */
function generateReleaseNotes(version, customData = {}, options = {}) {
  try {
    return renderReleaseNotes(
      generateReleaseData(version, customData, options),
    );
  } catch (error) {
    throw new Error(`Failed to generate release notes: ${error.message}`);
  }
}

export { generateReleaseData, generateReleaseNotes, renderReleaseNotes };

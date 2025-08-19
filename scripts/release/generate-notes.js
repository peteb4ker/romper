#!/usr/bin/env node

/**
 * Release notes generator
 * Generates release notes from templates and parsed commit data
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { parseCommitsSinceLastTag } from "./parse-commits.js";

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
    templateName
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
 * Generate release notes data object
 */
function generateReleaseData(version, customData = {}) {
  const commitData = parseCommitsSinceLastTag();
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  // Prepare template data
  const data = {
    version,
    date,
    platform: getPlatformIdentifier(),
    previous_version: commitData.previousTag || "initial",

    // Highlights can be customized
    highlights: customData.highlights || null,

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

    // Known issues (can be customized)
    known_issues: customData.knownIssues || null,

    // Additional custom data
    ...customData,
  };

  return data;
}

/**
 * Generate release notes from template
 */
function generateReleaseNotes(version, customData = {}) {
  try {
    const template = loadTemplate("RELEASE_NOTES_TEMPLATE.md");
    const data = generateReleaseData(version, customData);

    return template(data);
  } catch (error) {
    throw new Error(`Failed to generate release notes: ${error.message}`);
  }
}

/**
 * Generate changelog entry from template
 */
function generateChangelogEntry(version, customData = {}) {
  try {
    const template = loadTemplate("CHANGELOG_ENTRY_TEMPLATE.md");
    const data = generateReleaseData(version, customData);

    return template(data);
  } catch (error) {
    throw new Error(`Failed to generate changelog entry: ${error.message}`);
  }
}

/**
 * Create or update CHANGELOG.md file
 */
function updateChangelog(version, customData = {}) {
  const changelogPath = path.join(projectRoot, "CHANGELOG.md");
  const newEntry = generateChangelogEntry(version, customData);

  let existingContent = "";

  // Read existing changelog if it exists
  if (fs.existsSync(changelogPath)) {
    existingContent = fs.readFileSync(changelogPath, "utf8");
  } else {
    // Create new changelog with header
    existingContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  }

  // Insert new entry after the header
  const lines = existingContent.split("\n");
  const headerEndIndex = lines.findIndex((line) => line.trim() === "") + 1;

  const updatedLines = [
    ...lines.slice(0, headerEndIndex),
    newEntry,
    ...lines.slice(headerEndIndex),
  ];

  const updatedContent = updatedLines.join("\n");
  fs.writeFileSync(changelogPath, updatedContent, "utf8");

  return changelogPath;
}

/**
 * Preview release notes in a formatted way
 */
function previewReleaseNotes(version, customData = {}) {
  const notes = generateReleaseNotes(version, customData);
  const commitData = parseCommitsSinceLastTag();

  console.log("\n" + "=".repeat(80));
  console.log(`RELEASE NOTES PREVIEW FOR v${version}`);
  console.log("=".repeat(80));
  console.log(notes);
  console.log("=".repeat(80));

  if (!commitData.hasChanges) {
    console.log("⚠️  No commits found since last release!");
  } else {
    console.log(
      `📊 Summary: ${commitData.commitCount} commits from ${commitData.contributors.length} contributors`
    );
  }

  console.log("\n");
}

/**
 * Get release notes data for inspection
 */
function getReleaseData(version, customData = {}) {
  return generateReleaseData(version, customData);
}

/**
 * Validate that templates exist and are valid
 */
function validateTemplates() {
  const templates = [
    "RELEASE_NOTES_TEMPLATE.md",
    "CHANGELOG_ENTRY_TEMPLATE.md",
  ];

  const errors = [];

  for (const template of templates) {
    try {
      loadTemplate(template);
    } catch (error) {
      errors.push(`${template}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Template validation failed:\n${errors.join("\n")}`);
  }

  return true;
}

export {
  loadTemplate,
  generateReleaseData,
  generateReleaseNotes,
  generateChangelogEntry,
  updateChangelog,
  previewReleaseNotes,
  getReleaseData,
  validateTemplates,
};

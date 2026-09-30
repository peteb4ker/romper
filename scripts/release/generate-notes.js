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

export { generateReleaseNotes };

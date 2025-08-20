#!/usr/bin/env node

/**
 * GitHub Release Notes Generator for CI/CD
 *
 * This script generates release notes for GitHub Actions workflow.
 * It outputs clean markdown to stdout for the workflow to capture.
 *
 * Usage: node scripts/generate-github-release-notes.js <version>
 */

import { generateReleaseNotes } from "./release/generate-notes.js";

// Get version from command line arguments
const version = process.argv[2];

if (!version) {
  console.error("Error: Version number required");
  console.error(
    "Usage: node scripts/generate-github-release-notes.js <version>",
  );
  process.exit(1);
}

// Strip 'v' prefix if present for consistency
const cleanVersion = version.startsWith("v") ? version.substring(1) : version;

try {
  // Generate release notes
  const releaseNotes = generateReleaseNotes(cleanVersion);

  // Output to stdout for GitHub Actions to capture
  console.log(releaseNotes);
} catch (error) {
  console.error(`Error generating release notes: ${error.message}`);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Main release orchestrator
 * Coordinates the entire release process
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import semver from "semver";
import { validateRelease } from "./validate.js";
import {
  parseCommitsSinceLastTag,
  getChangesSummary,
} from "./parse-commits.js";
import {
  previewReleaseNotes,
  updateChangelog,
  validateTemplates,
} from "./generate-notes.js";
import {
  getCurrentBranch,
  isWorkingDirectoryClean,
  tagExists,
  createTag,
  pushTags,
  isRemoteUpToDate,
} from "./utils/git.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

/**
 * Read package.json
 */
function readPackageJson() {
  const packagePath = path.join(projectRoot, "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf8"));
}

/**
 * Update package.json version
 */
function updatePackageVersion(newVersion) {
  const packagePath = path.join(projectRoot, "package.json");
  const packageJson = readPackageJson();

  packageJson.version = newVersion;

  fs.writeFileSync(
    packagePath,
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf8",
  );
  console.log(chalk.green(`✅ Updated package.json version to ${newVersion}`));
}

/**
 * Get version suggestions based on current version
 */
function getVersionSuggestions(currentVersion) {
  const current = semver.parse(currentVersion);

  if (!current) {
    throw new Error(`Invalid current version: ${currentVersion}`);
  }

  return {
    patch: semver.inc(currentVersion, "patch"),
    minor: semver.inc(currentVersion, "minor"),
    major: semver.inc(currentVersion, "major"),
  };
}

/**
 * Prompt user for version selection
 */
async function promptVersionSelection() {
  const packageJson = readPackageJson();
  const currentVersion = packageJson.version;
  const suggestions = getVersionSuggestions(currentVersion);
  const _commitData = parseCommitsSinceLastTag();

  console.log(chalk.blue(`📦 Current version: ${currentVersion}`));
  console.log(chalk.blue(`📊 Changes: ${getChangesSummary()}`));
  console.log();

  const { versionType } = await inquirer.prompt([
    {
      type: "list",
      name: "versionType",
      message: "What type of release is this?",
      choices: [
        {
          name: `🐛 Patch (${suggestions.patch}) - Bug fixes and small changes`,
          value: "patch",
          short: suggestions.patch,
        },
        {
          name: `✨ Minor (${suggestions.minor}) - New features, backward compatible`,
          value: "minor",
          short: suggestions.minor,
        },
        {
          name: `💥 Major (${suggestions.major}) - Breaking changes`,
          value: "major",
          short: suggestions.major,
        },
        {
          name: "📝 Custom - Enter a specific version",
          value: "custom",
          short: "custom",
        },
      ],
    },
  ]);

  let newVersion;

  if (versionType === "custom") {
    const { customVersion } = await inquirer.prompt([
      {
        type: "input",
        name: "customVersion",
        message: "Enter the new version:",
        validate: (input) => {
          if (!semver.valid(input)) {
            return "Please enter a valid semantic version (e.g., 1.2.3)";
          }
          if (!semver.gt(input, currentVersion)) {
            return `Version must be greater than current version (${currentVersion})`;
          }
          return true;
        },
      },
    ]);
    newVersion = customVersion;
  } else {
    newVersion = suggestions[versionType];
  }

  // Check if tag already exists
  if (tagExists(`v${newVersion}`)) {
    throw new Error(
      `Tag v${newVersion} already exists. Choose a different version.`,
    );
  }

  return newVersion;
}

/**
 * Preview and confirm release
 */
async function previewAndConfirmRelease(version) {
  console.log(chalk.yellow("\n📋 Release Preview"));
  console.log(chalk.yellow("=".repeat(50)));

  // Show release notes preview
  previewReleaseNotes(version);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Are you ready to release v${version}?`,
      default: false,
    },
  ]);

  return confirm;
}

/**
 * Perform pre-release checks
 */
async function performPreReleaseChecks() {
  const spinner = ora("Running pre-release validation...").start();

  try {
    // Check git status
    const branch = getCurrentBranch();
    if (branch !== "main") {
      throw new Error(`Must be on main branch (currently on: ${branch})`);
    }

    if (!isWorkingDirectoryClean()) {
      throw new Error(
        "Working directory is not clean. Please commit or stash changes.",
      );
    }

    if (!isRemoteUpToDate()) {
      throw new Error(
        "Local branch is not up to date with remote. Please pull latest changes.",
      );
    }

    // Validate templates
    validateTemplates();

    // Run validation checks
    await validateRelease();

    spinner.succeed("All pre-release checks passed");
    return true;
  } catch (error) {
    spinner.fail(`Pre-release validation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the release
 */
async function executeRelease(version, dryRun = false) {
  const spinner = ora(
    dryRun ? "Dry run: Simulating release..." : "Creating release...",
  ).start();

  try {
    if (!dryRun) {
      // Update package.json
      updatePackageVersion(version);

      // Update changelog
      const changelogPath = updateChangelog(version);
      spinner.text = "Updated CHANGELOG.md";

      // Create and push tag
      createTag(`v${version}`, `Release v${version}`);
      pushTags();

      spinner.succeed(`✅ Release v${version} created successfully!`);

      console.log(chalk.green("\n🎉 Release Summary:"));
      console.log(chalk.green(`   📦 Version: ${version}`));
      console.log(chalk.green(`   🏷️  Tag: v${version}`));
      console.log(chalk.green(`   📄 Changelog: ${changelogPath}`));
      console.log(
        chalk.green(`   🚀 GitHub Actions will build and publish the release`),
      );
      console.log(
        chalk.green(
          `   🔗 Monitor progress: https://github.com/peteb4ker/romper/actions`,
        ),
      );
    } else {
      spinner.succeed("✅ Dry run completed - no changes made");

      console.log(chalk.yellow("\n🧪 Dry Run Summary:"));
      console.log(chalk.yellow(`   📦 Would update version to: ${version}`));
      console.log(chalk.yellow(`   🏷️  Would create tag: v${version}`));
      console.log(chalk.yellow(`   📄 Would update CHANGELOG.md`));
      console.log(chalk.yellow(`   🚀 Would trigger GitHub Actions build`));
    }
  } catch (error) {
    spinner.fail(dryRun ? "Dry run failed" : "Release failed");
    throw error;
  }
}

/**
 * Main release function
 */
async function release(options = {}) {
  const { dryRun = false, skipChecks = false } = options;

  try {
    console.log(chalk.blue("🚀 Romper Release Automation"));
    console.log(chalk.blue("=".repeat(40)));

    // Pre-release checks
    if (!skipChecks) {
      await performPreReleaseChecks();
    } else {
      console.log(chalk.yellow("⚠️  Skipping pre-release checks"));
    }

    // Version selection
    const version = await promptVersionSelection();

    // Preview and confirm
    const confirmed = await previewAndConfirmRelease(version);

    if (!confirmed) {
      console.log(chalk.yellow("❌ Release cancelled by user"));
      process.exit(0);
    }

    // Execute release
    await executeRelease(version, dryRun);

    if (!dryRun) {
      console.log(chalk.green("\n✨ Release completed successfully!"));
      console.log(
        chalk.green(
          "   The GitHub Actions workflow will now build and publish the release.",
        ),
      );
      console.log(
        chalk.green(
          "   You can monitor the progress in the Actions tab on GitHub.",
        ),
      );
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Release failed: ${error.message}`));
    console.error(chalk.red("   Please fix the issue and try again."));
    process.exit(1);
  }
}

/**
 * CLI interface
 */
function parseCLIArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes("--dry-run") || args.includes("-d"),
    skipChecks: args.includes("--skip-checks") || args.includes("-s"),
    help: args.includes("--help") || args.includes("-h"),
  };

  return options;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${chalk.blue("Romper Release Automation")}

Usage: npm run release [options]

Options:
  -d, --dry-run        Run without making any changes
  -s, --skip-checks    Skip pre-release validation checks
  -h, --help           Show this help message

Examples:
  npm run release                 # Interactive release
  npm run release -- --dry-run    # Preview what would happen
  npm run release -- --skip-checks # Skip validation (not recommended)

The release process will:
  1. Validate your environment and codebase
  2. Parse commits since the last release
  3. Let you choose the version number
  4. Generate release notes from templates
  5. Update package.json and CHANGELOG.md
  6. Create and push a git tag
  7. Trigger GitHub Actions to build and publish
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCLIArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  release(options).catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { release, executeRelease, performPreReleaseChecks };

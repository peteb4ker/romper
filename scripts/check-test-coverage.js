#!/usr/bin/env node

/**
 * Check Test Coverage Script
 *
 * Ensures every testable file has a corresponding test file.
 * Based on Vite config include/exclude patterns from vite.config.ts.
 */

import { glob } from "glob";
import { existsSync } from "fs";
import { dirname, basename, extname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = dirname(__dirname);

// Patterns from vite.config.ts coverage.include
const INCLUDE_PATTERNS = [
  "app/renderer/**/*.ts",
  "app/renderer/**/*.tsx",
  "shared/**/*.ts",
  "electron/**/*.ts",
];

// Patterns from vite.config.ts coverage.exclude
const EXCLUDE_PATTERNS = [
  "**/*.d.ts",
  "app/renderer/styles/**",
  "**/__tests__/**",
  "**/test-utils/**",
  "**/*.test.*",
  "**/*Mock*.tsx",
  "**/*Mock*.ts",
  "**/*.e2e.test.*",
];

/**
 * Check if a file path matches any exclude pattern
 */
function isExcluded(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\./g, "\\.");

    return new RegExp(regexPattern).test(filePath);
  });
}

/**
 * Get expected test file paths for a source file
 * Tests are located in __tests__ subdirectories alongside source files
 */
function getExpectedTestPaths(sourceFile) {
  const dir = dirname(sourceFile);
  const name = basename(sourceFile, extname(sourceFile));
  const ext = extname(sourceFile);

  return {
    unit: join(dir, "__tests__", `${name}.test${ext}`),
    integration: join(dir, "__tests__", `${name}.integration.test${ext}`),
  };
}

/**
 * Check what types of tests exist for a source file
 */
function getTestStatus(sourceFile) {
  const testPaths = getExpectedTestPaths(sourceFile);
  const dir = dirname(sourceFile);
  const name = basename(sourceFile, extname(sourceFile));

  // Check for both .ts and .tsx test files for better compatibility
  const unitPathTs = join(dir, "__tests__", `${name}.test.ts`);
  const unitPathTsx = join(dir, "__tests__", `${name}.test.tsx`);
  const integrationPathTs = join(
    dir,
    "__tests__",
    `${name}.integration.test.ts`,
  );
  const integrationPathTsx = join(
    dir,
    "__tests__",
    `${name}.integration.test.tsx`,
  );

  return {
    hasUnit:
      existsSync(join(ROOT_DIR, testPaths.unit)) ||
      existsSync(join(ROOT_DIR, unitPathTs)) ||
      existsSync(join(ROOT_DIR, unitPathTsx)),
    hasIntegration:
      existsSync(join(ROOT_DIR, testPaths.integration)) ||
      existsSync(join(ROOT_DIR, integrationPathTs)) ||
      existsSync(join(ROOT_DIR, integrationPathTsx)),
    unitPath: testPaths.unit,
    integrationPath: testPaths.integration,
  };
}

/**
 * Main function
 */
async function checkTestCoverage() {
  console.log("🔍 Checking test coverage for all testable files...\n");

  const missingTests = [];
  const integrationOnly = [];
  const totalFiles = [];

  for (const pattern of INCLUDE_PATTERNS) {
    const files = await glob(pattern, {
      cwd: ROOT_DIR,
      ignore: EXCLUDE_PATTERNS,
    });

    for (const file of files) {
      if (!isExcluded(file)) {
        totalFiles.push(file);
        const testStatus = getTestStatus(file);

        if (!testStatus.hasUnit && !testStatus.hasIntegration) {
          // No tests at all
          missingTests.push({
            sourceFile: file,
            unitPath: testStatus.unitPath,
            integrationPath: testStatus.integrationPath,
          });
        } else if (!testStatus.hasUnit && testStatus.hasIntegration) {
          // Has integration test but no unit test
          integrationOnly.push({
            sourceFile: file,
            integrationPath: testStatus.integrationPath,
          });
        }
      }
    }
  }

  const testedFiles = totalFiles.length - missingTests.length;

  console.log(`📊 Summary:`);
  console.log(`  Total testable files: ${totalFiles.length}`);
  console.log(`  Files with tests: ${testedFiles}`);
  console.log(`  Files missing tests: ${missingTests.length}`);
  console.log(`  Files with integration tests only: ${integrationOnly.length}`);
  console.log(
    `  Test coverage: ${Math.round((testedFiles / totalFiles.length) * 100)}%\n`,
  );

  // Show integration-only files as info
  if (integrationOnly.length > 0) {
    console.log(
      `ℹ️  ${integrationOnly.length} files covered by integration tests only:\n`,
    );

    const integrationGrouped = integrationOnly.reduce(
      (acc, { sourceFile, integrationPath }) => {
        const dir = dirname(sourceFile);
        if (!acc[dir]) acc[dir] = [];
        acc[dir].push({ sourceFile, integrationPath });
        return acc;
      },
      {},
    );

    Object.keys(integrationGrouped)
      .sort()
      .forEach((dir) => {
        console.log(`📁 ${dir}/:`);
        integrationGrouped[dir].forEach(({ sourceFile, integrationPath }) => {
          const fileName = basename(sourceFile);
          const testFileName = basename(integrationPath);
          console.log(`  ℹ️  ${fileName} → covered by ${testFileName}`);
        });
        console.log();
      });
  }

  if (missingTests.length === 0) {
    console.log("✅ All testable files have corresponding test files!");
    process.exit(0);
  }

  console.log(`❌ Found ${missingTests.length} files without tests:\n`);

  // Group by directory for better readability
  const groupedByDir = missingTests.reduce((acc, { sourceFile, unitPath }) => {
    const dir = dirname(sourceFile);
    if (!acc[dir]) acc[dir] = [];
    acc[dir].push({ sourceFile, unitPath });
    return acc;
  }, {});

  Object.keys(groupedByDir)
    .sort()
    .forEach((dir) => {
      console.log(`📁 ${dir}/:`);
      groupedByDir[dir].forEach(({ sourceFile, unitPath }) => {
        const fileName = basename(sourceFile);
        const testFileName = basename(unitPath);
        console.log(`  ❌ ${fileName} → needs ${testFileName}`);
      });
      console.log();
    });

  console.log(
    "💡 To fix: Create test files in the expected __tests__ subdirectories.",
  );
  console.log(
    "💡 Use existing test files as templates for structure and patterns.",
  );
  console.log(
    "💡 Integration tests can substitute for unit tests in some cases.",
  );
  console.log("💡 Run this script again to verify all tests are created.");

  process.exit(1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkTestCoverage().catch(console.error);
}

export { checkTestCoverage };

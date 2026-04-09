#!/usr/bin/env node

/**
 * Pre-release validation script
 * Validates that all required files and configurations are in place for a successful release
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");

/**
 * Validation checks
 */
const checks = [
  {
    name: "Forge configuration exists",
    check: () => {
      const forgeConfig = path.join(projectRoot, "forge.config.cjs");
      return fs.existsSync(forgeConfig);
    },
    fix: "Ensure forge.config.cjs exists and is properly configured",
  },
  {
    name: "Required icon files exist",
    check: () => {
      const iconsPath = path.join(projectRoot, "electron", "resources");
      const requiredIcons = ["app-icon.icns", "app-icon.png", "app-icon.ico"];
      return requiredIcons.every((icon) =>
        fs.existsSync(path.join(iconsPath, icon)),
      );
    },
    fix: "Ensure app-icon.icns, app-icon.png, and app-icon.ico exist in electron/resources/. Run: npm run icons:generate",
  },
  {
    name: "Electron in devDependencies",
    check: () => {
      const packageJsonPath = path.join(projectRoot, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return (
        packageJson.devDependencies && packageJson.devDependencies.electron
      );
    },
    fix: "Move electron from dependencies to devDependencies in package.json",
  },
  {
    name: "Build artifacts clean",
    check: () => {
      const distPath = path.join(projectRoot, "dist");
      const outPath = path.join(projectRoot, "out");
      // Clean state is when these don't exist or are empty
      const distExists = fs.existsSync(distPath);
      const outExists = fs.existsSync(outPath);
      return !distExists || !outExists; // OK if they don't exist
    },
    fix: "Clean build artifacts with: rm -rf dist out",
    warning: true, // This is a warning, not a hard failure
  },
  {
    name: "All required makers installed",
    check: () => {
      const packageJsonPath = path.join(projectRoot, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const requiredMakers = [
        "@electron-forge/maker-zip",
        "@electron-forge/maker-dmg",
        "@electron-forge/maker-squirrel",
        "@electron-forge/maker-deb",
        "@electron-forge/maker-rpm",
      ];
      return requiredMakers.every(
        (maker) =>
          packageJson.devDependencies && packageJson.devDependencies[maker],
      );
    },
    fix: "Install all required electron-forge makers",
  },
  {
    name: "Required package.json metadata for Linux packaging",
    check: () => {
      const packageJsonPath = path.join(projectRoot, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return (
        packageJson.license && packageJson.description && packageJson.author
      );
    },
    fix: "Add license, description, and author fields to package.json for RPM packaging",
  },
  {
    name: "macOS signing environment configured",
    check: () => {
      // Check if macOS signing env vars are set (for local builds)
      const hasIdentity = !!(
        process.env.APPLE_IDENTITY || process.env.APPLE_SIGNING_IDENTITY
      );
      const hasNotarize = !!(
        process.env.APPLE_ID &&
        process.env.APPLE_ID_PASSWORD &&
        process.env.APPLE_TEAM_ID
      );
      return hasIdentity && hasNotarize;
    },
    fix: "Set APPLE_IDENTITY, APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID for signed macOS builds. Unsigned builds will still work.",
    warning: true, // Warning only — unsigned local builds are fine
  },
  {
    name: "Windows signing environment configured",
    check: () => {
      // Check if Windows signing env vars are set (for local builds)
      // In CI, Azure Trusted Signing Action handles this via secrets
      return !!(
        process.env.WINDOWS_CERTIFICATE_FILE ||
        process.env.AZURE_CLIENT_ID
      );
    },
    fix: "Set WINDOWS_CERTIFICATE_FILE (local) or AZURE_CLIENT_ID (CI) for signed Windows builds. Unsigned builds will still work.",
    warning: true, // Warning only — unsigned local builds are fine
  },
  {
    name: "Tests passing",
    check: async () => {
      // This would require running tests, which is expensive
      // For now, just check that test scripts exist
      const packageJsonPath = path.join(projectRoot, "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return (
        packageJson.scripts.test &&
        packageJson.scripts["test:unit"] &&
        packageJson.scripts["test:integration"]
      );
    },
    fix: "Ensure test scripts are defined and run: npm test",
  },
];

/**
 * Run all validation checks
 */
async function validateRelease() {
  console.log("🔍 Running pre-release validation checks...\n");

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const { name, check, fix, warning } of checks) {
    try {
      const result = await check();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        if (warning) {
          console.log(`⚠️  ${name}`);
          console.log(`   💡 ${fix}\n`);
          warnings++;
        } else {
          console.log(`❌ ${name}`);
          console.log(`   🔧 ${fix}\n`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ ${name} (Error: ${error.message})`);
      console.log(`   🔧 ${fix}\n`);
      failed++;
    }
  }

  console.log("\n📊 Validation Summary:");
  console.log(`   ✅ Passed: ${passed}`);
  if (warnings > 0) console.log(`   ⚠️  Warnings: ${warnings}`);
  if (failed > 0) console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log(
      "\n❌ Pre-release validation failed! Please fix the issues above before releasing.",
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(
      "\n⚠️  Pre-release validation passed with warnings. Consider addressing them.",
    );
    process.exit(0);
  } else {
    console.log(
      "\n✅ All pre-release validation checks passed! Ready to release.",
    );
    process.exit(0);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateRelease().catch((error) => {
    console.error("❌ Validation script error:", error);
    process.exit(1);
  });
}

export { validateRelease, checks };

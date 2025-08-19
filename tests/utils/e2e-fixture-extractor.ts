/**
 * E2E Fixture Extractor Utility
 *
 * Provides utilities for extracting and setting up pre-built E2E fixtures
 * that contain a complete initialized local store.
 */

import fs from "fs-extra";
import path from "path";
import * as tar from "tar";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/e2e");
const FIXTURE_ARCHIVE = "local-store-fixture.tar.gz";
const FIXTURE_METADATA = "fixture-metadata.json";

export interface E2EFixtureMetadata {
  archivePath: string;
  environment: {
    ROMPER_LOCAL_PATH: string;
    ROMPER_SDCARD_PATH: string;
  };
  extractTo: string;
  generated: string;
  kits: string[];
  source: string;
  usage: string;
}

export interface E2ETestEnvironment {
  environment: Record<string, string>;
  localStorePath: string;
  metadata: E2EFixtureMetadata;
  tempSdcardPath: string;
}

/**
 * Check if E2E fixtures are available and up-to-date
 */
export async function checkE2EFixtureStatus(): Promise<{
  available: boolean;
  message: string;
  metadata?: E2EFixtureMetadata;
}> {
  const fixtureArchivePath = path.join(FIXTURES_DIR, FIXTURE_ARCHIVE);
  const metadataPath = path.join(FIXTURES_DIR, FIXTURE_METADATA);

  if (
    !(await fs.pathExists(fixtureArchivePath)) ||
    !(await fs.pathExists(metadataPath))
  ) {
    return {
      available: false,
      message:
        "E2E fixtures not found. Run 'npm run fixtures:e2e' to generate them.",
    };
  }

  const metadata = await fs.readJSON(metadataPath);

  return {
    available: true,
    message: `E2E fixtures available (generated ${metadata.generated}) with ${metadata.kits.length} kits: ${metadata.kits.join(", ")}`,
    metadata,
  };
}

/**
 * Clean up extracted E2E fixtures
 */
export async function cleanupE2EFixture(
  testEnv: E2ETestEnvironment
): Promise<void> {
  console.log(`[E2E Fixture] Cleaning up test environment...`);

  const cleanupPromises = [];

  if (await fs.pathExists(testEnv.localStorePath)) {
    cleanupPromises.push(fs.remove(testEnv.localStorePath));
  }

  if (await fs.pathExists(testEnv.tempSdcardPath)) {
    cleanupPromises.push(fs.remove(testEnv.tempSdcardPath));
  }

  await Promise.all(cleanupPromises);
  console.log(`[E2E Fixture] Cleanup completed.`);
}

/**
 * Extract pre-built E2E fixture to a temporary directory
 */
export async function extractE2EFixture(): Promise<E2ETestEnvironment> {
  const fixtureArchivePath = path.join(FIXTURES_DIR, FIXTURE_ARCHIVE);
  const metadataPath = path.join(FIXTURES_DIR, FIXTURE_METADATA);

  // Verify fixtures exist
  if (!(await fs.pathExists(fixtureArchivePath))) {
    throw new Error(
      `E2E fixture archive not found: ${fixtureArchivePath}. Run 'npm run fixtures:e2e' to generate fixtures.`
    );
  }

  if (!(await fs.pathExists(metadataPath))) {
    throw new Error(
      `E2E fixture metadata not found: ${metadataPath}. Run 'npm run fixtures:e2e' to generate fixtures.`
    );
  }

  // Read metadata
  const metadata: E2EFixtureMetadata = await fs.readJSON(metadataPath);

  // Create temporary directories
  const testId = Date.now();
  const localStorePath = path.join("/tmp", `romper-e2e-local-${testId}`);
  const tempSdcardPath = path.join("/tmp", `romper-e2e-sdcard-${testId}`);

  await fs.ensureDir(localStorePath);
  await fs.ensureDir(tempSdcardPath);

  console.log(`[E2E Fixture] Extracting fixture to: ${localStorePath}`);

  // Extract the archive to the local store path
  await tar.extract({
    cwd: localStorePath,
    file: fixtureArchivePath,
    strip: 0, // Don't strip directory levels
  });

  console.log(
    `[E2E Fixture] Extraction completed. Found kits: ${metadata.kits.join(", ")}`
  );

  // Set up environment variables
  // Note: We set both ROMPER_LOCAL_PATH and ROMPER_SDCARD_PATH to point to our temp directories
  // This prevents tests from hanging on SD card selection
  const environment = {
    NODE_ENV: "test",
    ROMPER_LOCAL_PATH: localStorePath,
    ROMPER_SDCARD_PATH: tempSdcardPath,
    ROMPER_TEST_MODE: "true",
  };

  return {
    environment,
    localStorePath,
    metadata,
    tempSdcardPath,
  };
}

/**
 * Get information about available E2E fixtures
 */
export async function getE2EFixtureInfo(): Promise<E2EFixtureMetadata | null> {
  const metadataPath = path.join(FIXTURES_DIR, FIXTURE_METADATA);

  if (!(await fs.pathExists(metadataPath))) {
    return null;
  }

  return await fs.readJSON(metadataPath);
}

/**
 * Verify that extracted fixtures are valid
 */
export async function verifyE2EFixture(
  testEnv: E2ETestEnvironment
): Promise<boolean> {
  try {
    // Check that local store directory exists
    if (!(await fs.pathExists(testEnv.localStorePath))) {
      console.error(
        `[E2E Fixture] Local store path does not exist: ${testEnv.localStorePath}`
      );
      return false;
    }

    // Check that database exists
    const dbPath = path.join(
      testEnv.localStorePath,
      ".romperdb",
      "romper.sqlite"
    );
    if (!(await fs.pathExists(dbPath))) {
      console.error(`[E2E Fixture] Database does not exist: ${dbPath}`);
      return false;
    }

    // Check that kit folders exist
    for (const kitName of testEnv.metadata.kits) {
      const kitPath = path.join(testEnv.localStorePath, kitName);
      if (!(await fs.pathExists(kitPath))) {
        console.error(`[E2E Fixture] Kit folder does not exist: ${kitPath}`);
        return false;
      }

      // Check that kit has sample files
      const files = await fs.readdir(kitPath);
      const wavFiles = files.filter((f) => f.endsWith(".wav"));
      if (wavFiles.length === 0) {
        console.error(`[E2E Fixture] Kit ${kitName} has no WAV files`);
        return false;
      }
    }

    console.log(
      `[E2E Fixture] Verification completed successfully. Database and ${testEnv.metadata.kits.length} kits verified.`
    );
    return true;
  } catch (error) {
    console.error(`[E2E Fixture] Verification failed:`, error);
    return false;
  }
}

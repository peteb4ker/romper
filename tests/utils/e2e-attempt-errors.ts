/**
 * The e2e error guard's memory across retries (#659).
 *
 * CI retries a failed e2e test once (playwright.config.ts). The retry runs
 * in a fresh worker, so an attempt whose app reported unexpected errors
 * writes them here, and the retry reads them back: an unexpected error
 * still fails the test even when the retry is clean, as it did before
 * retries. The files live in the run's output folder, which Playwright
 * empties when a run starts.
 */
import fs from "node:fs";
import path from "node:path";

const FOLDER = ".error-guard";

/** The errors an earlier attempt of this test reported, if any */
export function earlierAttemptErrors(
  outputDir: string,
  testId: string,
): string[] {
  try {
    const text = fs.readFileSync(
      path.join(outputDir, FOLDER, `${testId}.json`),
      "utf8",
    );
    const errors: unknown = JSON.parse(text);
    return Array.isArray(errors) ? errors.map(String) : [];
  } catch {
    return [];
  }
}

/** Keep the errors an attempt reported, for its retry */
export function recordAttemptErrors(
  outputDir: string,
  testId: string,
  errors: string[],
) {
  const dir = path.join(outputDir, FOLDER);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${testId}.json`), JSON.stringify(errors));
}

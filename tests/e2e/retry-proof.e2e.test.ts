import { _electron as electron } from "@playwright/test";

import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";

// TEMPORARY (#659): proves CI's retry, the flaky summary and the error
// guard across retries. Reverted before merge.
test.describe("Retry proof (#659, temporary)", () => {
  test("fails on its first attempt, passes on retry", () => {
    expect(test.info().retry, "deliberately flaky").toBeGreaterThan(0);
  });

  test("logs an unexpected error on its first attempt only", async () => {
    const testEnv = await extractE2EFixture();
    const app = await electron.launch({
      args: ["dist/electron/main/index.js"],
      env: { ...process.env, ...testEnv.environment },
      timeout: 30000,
    });
    const window = await app.firstWindow();
    await window.waitForSelector('[data-testid="kits-view"]', {
      timeout: 10000,
    });
    if (test.info().retry === 0) {
      await window.evaluate(() => console.error("retry proof: first attempt"));
    }
    await app.close();
    await cleanupE2EFixture(testEnv);
  });
});

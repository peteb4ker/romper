import { _electron as electron, expect, test } from "@playwright/test";
import fs from "fs-extra";
import os from "node:os";
import path from "node:path";

/**
 * Onboarding Error Recovery E2E Tests
 *
 * Tests high-severity error scenarios in the wizard/onboarding flow:
 * 1. SD card with no valid kit folders
 * 2. Blank folder shows post-initialization guidance
 * 3. Wizard error display renders correctly
 */
test.describe("Onboarding Error Recovery E2E Tests", () => {
  // Each test manages its own Electron app lifecycle since environment varies per scenario
  let tempDirs: string[] = [];

  test.afterEach(async () => {
    // Clean up all temp directories created during the test
    for (const dir of tempDirs) {
      await fs.remove(dir).catch(() => {});
    }
    tempDirs = [];
  });

  /**
   * Helper to create a unique temp directory and track it for cleanup.
   */
  async function createTempDir(prefix: string): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  /**
   * Helper to launch Electron with wizard-triggering environment.
   * Setting ROMPER_LOCAL_PATH to empty string forces the wizard to open.
   */
  async function launchWizardApp(env: Record<string, string>) {
    const electronApp = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: {
        ...process.env,
        ROMPER_LOCAL_PATH: "", // Empty string triggers wizard
        ...env,
      },
      timeout: 30000,
    });

    const window = await electronApp.firstWindow();

    window.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error(`[renderer error] ${msg.text()}`);
      }
    });

    await window.waitForLoadState("domcontentloaded");

    // Wait for wizard to appear and be interactive
    await window.waitForSelector('[data-testid="local-store-wizard"]', {
      state: "visible",
      timeout: 10000,
    });
    await window.waitForSelector('[data-testid="wizard-source-blank"]', {
      state: "visible",
      timeout: 5000,
    });

    return { electronApp, window };
  }

  test("should show error when SD card has no valid kit folders", async () => {
    // Create an SD card directory with files that are NOT valid kit folders
    const fakeSdCard = await createTempDir("romper-e2e-invalid-sdcard-");
    await fs.writeFile(
      path.join(fakeSdCard, "readme.txt"),
      "This is not a kit folder",
    );
    await fs.ensureDir(path.join(fakeSdCard, "photos"));
    await fs.ensureDir(path.join(fakeSdCard, ".hidden"));

    const { electronApp, window } = await launchWizardApp({
      ROMPER_SDCARD_PATH: fakeSdCard,
    });

    try {
      // Click the SD card source button
      const sdCardButton = window.locator(
        '[data-testid="wizard-source-sdcard"]',
      );
      await sdCardButton.click();

      // Create a target path for the local store
      const targetPath = await createTempDir("romper-e2e-target-");
      await window.waitForSelector("#local-store-path-input", {
        state: "visible",
        timeout: 5000,
      });
      await window.fill("#local-store-path-input", targetPath);

      // Click initialize - this should fail because the SD card has no valid kits
      const initButton = window.locator(
        '[data-testid="wizard-initialize-btn"]',
      );
      await initButton.waitFor({ state: "visible", timeout: 5000 });
      await initButton.click();

      // Wait for the error message to appear
      const errorElement = window.locator('[data-testid="wizard-error"]');
      await errorElement.waitFor({ state: "visible", timeout: 10000 });

      // Verify the error message mentions missing kit folders
      const errorText = await errorElement.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText!.toLowerCase()).toContain("no kit folders");
      console.log(
        `[E2E Onboarding Error] SD card error message: "${errorText}"`,
      );

      // Verify the wizard is still visible (user can retry)
      await expect(
        window.locator('[data-testid="local-store-wizard"]'),
      ).toBeVisible();
    } finally {
      await electronApp.close();
    }
  });

  test("should show post-init guidance for blank folder", async () => {
    const { electronApp, window } = await launchWizardApp({});

    try {
      // Select blank folder source
      const blankButton = window.locator('[data-testid="wizard-source-blank"]');
      await blankButton.click();

      // Enter a target path for the new blank local store
      const targetPath = await createTempDir("romper-e2e-blank-");
      await window.waitForSelector("#local-store-path-input", {
        state: "visible",
        timeout: 5000,
      });
      await window.fill("#local-store-path-input", targetPath);

      // Click initialize
      const initButton = window.locator(
        '[data-testid="wizard-initialize-btn"]',
      );
      await initButton.waitFor({ state: "visible", timeout: 5000 });
      await initButton.click();

      // Wait for the post-init guidance to appear
      const guidance = window.locator(
        '[data-testid="wizard-post-init-guidance"]',
      );
      await guidance.waitFor({ state: "visible", timeout: 15000 });
      console.log(
        "[E2E Onboarding Error] Post-init guidance appeared for blank folder",
      );

      // Verify the blank folder specific guidance content is shown
      const blankGuidance = window.locator(
        '[data-testid="blank-folder-guidance"]',
      );
      await expect(blankGuidance).toBeVisible();

      // Verify the continue button is present and shows "Open Kit Browser"
      const continueButton = window.locator(
        '[data-testid="post-init-continue-btn"]',
      );
      await expect(continueButton).toBeVisible();
      const buttonText = await continueButton.textContent();
      expect(buttonText).toContain("Open Kit Browser");

      // Verify the database was actually created
      const dbPath = path.join(targetPath, ".romperdb", "romper.sqlite");
      expect(await fs.pathExists(dbPath)).toBe(true);

      // Click continue to dismiss guidance
      await continueButton.click();

      // After dismissal, wizard should close and app should show main view
      await window.waitForSelector('[data-testid="local-store-wizard"]', {
        state: "hidden",
        timeout: 10000,
      });
    } finally {
      await electronApp.close();
    }
  });

  test("should render wizard error message with data-testid", async () => {
    // Create an SD card directory that initially looks valid but will cause an error
    // We use a directory with no kit folders to trigger the validation error
    const emptySdCard = await createTempDir("romper-e2e-empty-sdcard-");

    const { electronApp, window } = await launchWizardApp({
      ROMPER_SDCARD_PATH: emptySdCard,
    });

    try {
      // Click the SD card source button (environment has ROMPER_SDCARD_PATH set)
      const sdCardButton = window.locator(
        '[data-testid="wizard-source-sdcard"]',
      );
      await sdCardButton.click();

      // Set a target path
      const targetPath = await createTempDir("romper-e2e-error-target-");
      await window.waitForSelector("#local-store-path-input", {
        state: "visible",
        timeout: 5000,
      });
      await window.fill("#local-store-path-input", targetPath);

      // Click initialize to trigger error
      const initButton = window.locator(
        '[data-testid="wizard-initialize-btn"]',
      );
      await initButton.waitFor({ state: "visible", timeout: 5000 });
      await initButton.click();

      // Wait for the error element with the correct data-testid
      const errorElement = window.locator('[data-testid="wizard-error"]');
      await errorElement.waitFor({ state: "visible", timeout: 10000 });

      // Verify the error element exists and has content
      await expect(errorElement).toBeVisible();
      const errorText = await errorElement.textContent();
      expect(errorText).toBeTruthy();
      expect(errorText!.length).toBeGreaterThan(0);

      console.log(
        `[E2E Onboarding Error] Wizard error rendered: "${errorText}"`,
      );

      // Verify the error element has the correct data-testid attribute
      const testId = await errorElement.getAttribute("data-testid");
      expect(testId).toBe("wizard-error");

      // Verify the wizard remains visible for error recovery
      await expect(
        window.locator('[data-testid="local-store-wizard"]'),
      ).toBeVisible();

      // Verify user can still interact with the wizard after error
      // The source selection should still be accessible
      const blankButton = window.locator('[data-testid="wizard-source-blank"]');
      await expect(blankButton).toBeVisible();
    } finally {
      await electronApp.close();
    }
  });
});

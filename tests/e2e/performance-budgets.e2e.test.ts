/**
 * Performance budgets for user actions (tests/perf/budgets.ts).
 *
 * Drives the built app on the standard e2e fixture and counts the IPC calls
 * each common action makes, by channel. Call counts are deterministic, so
 * they're checked on every PR; timings and returned bytes are left to the
 * factory-scale profile in tests/validation/performance.validation.ts.
 */
import {
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { type BudgetName, enforceBudgets } from "../perf/budgets";
import { dropFiles } from "../utils/e2e-drop";
import { expect, test } from "../utils/e2e-error-guard";
import {
  cleanupE2EFixture,
  type E2ETestEnvironment,
  extractE2EFixture,
} from "../utils/e2e-fixture-extractor";
import {
  IPC_PROBE_ARGS,
  measureIpc,
  takeIpcCounts,
  waitForIpcQuiet,
} from "../utils/e2e-ipc-budget";
import { encodeTestWav, sine } from "../validation/support/wav";

test.describe("[Q-01] Performance budgets: IPC calls per action", () => {
  let app: ElectronApplication;
  let page: Page;
  let testEnv: E2ETestEnvironment;
  let sourceDir: string;

  test.beforeEach(async () => {
    testEnv = await extractE2EFixture();
    await renameKitSamples(testEnv.localStorePath, "B1");
    sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), "romper-e2e-src-"));
  });

  test.afterEach(async () => {
    await app?.close();
    if (testEnv) await cleanupE2EFixture(testEnv);
    if (sourceDir) await fs.rm(sourceDir, { force: true, recursive: true });
  });

  test("common actions stay within their IPC budgets", async () => {
    test.setTimeout(120_000);
    const check = (name: BudgetName, counts: Record<string, number>) => {
      expect.soft(enforceBudgets(name, counts), name).toEqual([]);
    };
    const action = async (name: BudgetName, run: () => Promise<void>) => {
      check(name, await measureIpc(app, run));
    };

    // Cold start: everything from launch until the grid has settled
    app = await electron.launch({
      args: [...IPC_PROBE_ARGS, "dist/electron/main/index.js"],
      env: {
        ...(process.env as Record<string, string>),
        ...testEnv.environment,
      },
      timeout: 30_000,
    });
    page = await app.firstWindow();
    await page.locator('[data-testid="kit-item-A0"]').waitFor();
    await waitForIpcQuiet(app);
    const coldStart = await takeIpcCounts(app);
    // Startup always loads the kits, so 0 means the probe isn't loaded
    expect(coldStart.total).toBeGreaterThan(0);
    check("e2e/cold start to the kit grid", coldStart);

    await action("e2e/open a kit", async () => {
      await page.locator('[data-testid="kit-item-A0"]').click();
      await page.locator('[data-testid="kit-editor"]').waitFor();
    });

    // A0 to B1, each with two filled slots (in the same voices and slots,
    // with different names)
    await action("e2e/next kit", async () => {
      await page.keyboard.press(".");
    });

    await action("e2e/enable editing", async () => {
      await page.getByTitle("Enable editable mode").click();
    });

    await page.keyboard.press("s");
    await page.locator('[data-testid="seq-step-0-0"]').waitFor();
    await action("e2e/toggle a sequencer step", async () => {
      await page.locator('[data-testid="seq-step-0-0"]').click();
    });

    await action("e2e/rename a voice", async () => {
      await page.getByTitle("Edit voice name").first().click();
      const input = page.locator("input:focus");
      await input.fill("Budget Kick");
      await input.press("Enter");
    });

    const wav = path.join(sourceDir, "budget drop.wav");
    await fs.writeFile(
      wav,
      encodeTestWav([sine(220, 0.2, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    await action("e2e/drop a sample", async () => {
      await dropFiles(page, 4, [wav]);
    });

    // "Confirm destructive actions" is on by default, so the trash button
    // asks first (RE-44)
    await action("e2e/delete a sample", async () => {
      await page.getByTitle("Delete sample").first().click();
      await page
        .locator('[data-testid="confirm-delete-sample-button"]')
        .click();
    });

    await action("e2e/gain: 5 wheel steps", async () => {
      await page.getByRole("slider").first().hover();
      for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100);
    });

    await page.locator('button[title="Back"]').click();
    await page.locator('[data-testid="kit-grid"]').waitFor();
    await action("e2e/open the write summary", async () => {
      await page.locator('[data-testid="sync-to-sd-card"]').click();
      await page.locator('[data-testid="bank-summary"]').waitFor();
    });
  });
});

/**
 * The fixture's kits A0 and B1 hold same-named samples in the same slots,
 * which hides the double fetch on kit navigation (RE-83): a waveform is
 * keyed by kit, slot and sample name, and remounts when the name changes a
 * render after the kit does. Real kits differ, so give B1's samples their
 * own names.
 */
async function renameKitSamples(storePath: string, kit: string) {
  const db = new DatabaseSync(
    path.join(storePath, ".romperdb", "romper.sqlite"),
  );
  try {
    const rows = db
      .prepare("SELECT id, filename FROM samples WHERE kit_name = ?")
      .all(kit) as { filename: string; id: number }[];
    for (const { filename, id } of rows) {
      const renamed = filename.replace(/\.wav$/i, `_${kit}.wav`);
      await fs.rename(
        path.join(storePath, kit, filename),
        path.join(storePath, kit, renamed),
      );
      db.prepare(
        "UPDATE samples SET filename = ?, source_path = ? WHERE id = ?",
      ).run(renamed, `${kit}/${renamed}`, id);
    }
  } finally {
    db.close();
  }
}

/**
 * Cancelling setup (RE-66; plan: docs/developer/validation-fix-plan.md item 4).
 *
 * From nothing: start a factory setup, cancel it while the archive is being
 * extracted, and check the app stopped and cleaned up after itself (no kit
 * folders or database left, no store saved). Then relaunch with the same
 * profile and set up the same folder: it must work, which it didn't when a
 * cancelled setup left a half-built store behind.
 *
 * Runs with `npm run validate:full`; report: validation-report/cancel-setup/.
 */
import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { ensureFactoryArchive, factoryArchive } from "./support/archive";
import { BASELINE_EXPECTED } from "./support/baseline";
import { readStore } from "./support/card";
import { type Expectation, MessageCollector } from "./support/collector";
import { ValidationReport } from "./support/report";

const FRESH = process.env.ROMPER_VALIDATE_FRESH === "true";
const REPORT_DIR = path.resolve(
  process.env.ROMPER_VALIDATE_REPORT_DIR ?? "validation-report",
  "cancel-setup",
);

const EXPECTED: Expectation[] = [
  ...BASELINE_EXPECTED,
  {
    pattern: /No local store configured/,
    reason: "each launch starts with no local store, so the wizard opens",
    sources: ["main-stdout"],
  },
  {
    pattern: /^confirm dialog: Setup is still running/,
    reason: "the run cancels setup, which asks first",
    sources: ["ui"],
  },
  {
    pattern: /won't fit|over 12|more than 12|were skipped|truncat/i,
    reason: "the factory set has two voices with more than 12 files",
  },
];

test("[UC-02] cancelling setup stops it, cleans up, and the same folder can be set up again", async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "romper-cancel-"));
  const dirs = {
    store: path.join(work, "store"),
    userData: path.join(work, "user-data"),
  };
  for (const dir of Object.values(dirs)) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.rm(REPORT_DIR, { force: true, recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const report = new ValidationReport(REPORT_DIR, {
    archive: FRESH ? "downloaded from Squarp (--fresh)" : "local copy",
    platform: `${process.platform}-${process.arch}`,
    scenario: "Cancel setup",
    started: new Date().toISOString(),
    work,
  });
  const collector = new MessageCollector();
  let app: ElectronApplication | undefined;
  let page: Page | undefined;

  const step = <T>(name: string, run: () => Promise<T>): Promise<T> =>
    report.step(name, async () => {
      collector.step = name;
      try {
        return await run();
      } finally {
        if (page && !page.isClosed()) await collector.harvest(page);
      }
    });

  const launch = async (archiveUrl: string) => {
    app = await electron.launch({
      args: [
        "dist/electron/main/index.js",
        `--user-data-dir=${dirs.userData}`,
        ...(process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
      ],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (e): e is [string, string] =>
              e[1] !== undefined && e[0] !== "ROMPER_LOCAL_PATH",
          ),
        ),
        ROMPER_SQUARP_ARCHIVE_URL: FRESH ? "" : archiveUrl,
        ROMPER_USER_DATA_DIR: dirs.userData,
      },
      timeout: 60_000,
    });
    collector.attach(app);
    await approveLocalStorePrompts(app);
    page = await app.firstWindow();
    await collector.attachPage(page);
    await page
      .locator('[data-testid="local-store-wizard"]')
      .waitFor({ timeout: 30_000 });
    return page;
  };

  const startSetup = async (p: Page) => {
    await p.locator('[data-testid="wizard-source-squarp"]').click();
    await p.locator("#local-store-path-input").fill(dirs.store);
    await p.locator('[data-testid="wizard-initialize-btn"]').click();
  };

  const storeEntries = async () =>
    (await fs.readdir(dirs.store)).filter((name) => name !== ".DS_Store");

  try {
    const archive = await step("Get the factory archive", async () => {
      const cached = await ensureFactoryArchive(FRESH, (l) => report.note(l));
      report.fact("archive", factoryArchive.fileName);
      return cached;
    });

    await step("Start setup and cancel it during extraction", async () => {
      const p = await launch(archive.fileUrl);
      const exited = new Promise<void>((resolve) =>
        app?.process().once("exit", () => resolve()),
      );
      await startSetup(p);
      // Cancel once kit folders are appearing, so there is work to undo
      await expect
        .poll(async () => (await storeEntries()).length, { timeout: 120_000 })
        .toBeGreaterThan(3);
      const before = (await storeEntries()).length;
      report.note(`${before} entries in the store when Cancel was pressed`);
      await p.locator('[data-testid="wizard-cancel-btn"]').click();

      // On first run, closing the wizard quits the app
      const outcome = await Promise.race([
        exited.then(() => "quit"),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("still running"), 60_000),
        ),
      ]);
      report.check("the app stops setup and quits", outcome === "quit", {
        details: outcome,
      });
      page = undefined;
      app = undefined;
    });

    await step("Check nothing is left behind", async () => {
      const left = await storeEntries();
      const kitsLeft = left.filter((name) => /^[A-Z]\d{1,2}$/.test(name));
      report.check(
        "no extracted kit folders are left in the store folder",
        kitsLeft.length === 0,
        { details: kitsLeft.slice(0, 10).join(", ") },
      );
      report.check(
        "no database is left where setup would refuse it",
        !left.includes(".romperdb"),
        { details: left.join(", ") },
      );
      const settings = await fs
        .readFile(path.join(dirs.userData, "romper-settings.json"), "utf8")
        .then((text) => JSON.parse(text) as { localStorePath?: null | string })
        .catch(() => ({}) as { localStorePath?: null | string });
      report.check(
        "the cancelled store isn't saved as the local store",
        !settings.localStorePath,
        { details: `localStorePath: ${settings.localStorePath}` },
      );
    });

    await step("Relaunch and set up the same folder", async () => {
      const p = await launch(archive.fileUrl);
      await startSetup(p);
      const outcome = await Promise.race([
        p
          .locator('[data-testid="wizard-post-init-guidance"]')
          .waitFor({ timeout: 30 * 60_000 })
          .then(() => "guidance"),
        p
          .locator('[data-testid="wizard-error"]')
          .waitFor({ timeout: 30 * 60_000 })
          .then(() => "error"),
      ]);
      const error =
        outcome === "error"
          ? await p.locator('[data-testid="wizard-error"]').textContent()
          : "";
      report.check("setup in the same folder succeeds", outcome !== "error", {
        details: error ?? "",
      });
      if (outcome === "guidance") {
        await p.locator('[data-testid="post-init-continue-btn"]').click();
      }
      await p.locator('[data-testid="kit-grid"]').waitFor({ timeout: 60_000 });
      const store = readStore(dirs.store);
      report.fact("kits imported", store.kits.length);
      report.check(
        `the store has all ${factoryArchive.contents.kitFolders} factory kits`,
        store.kits.length === factoryArchive.contents.kitFolders,
      );
    });
  } finally {
    if (page && !page.isClosed()) {
      await collector.harvest(page).catch(() => {});
    }
    await app?.close().catch(() => {});
    await report.write(collector.classify(EXPECTED), collector.logs);
    console.log(`Validation report: ${path.join(REPORT_DIR, "report.md")}`);
    if (process.env.ROMPER_VALIDATE_KEEP !== "true") {
      await fs.rm(work, { force: true, recursive: true }).catch(() => {});
    }
  }

  const failures = report.failures(collector.classify(EXPECTED));
  expect(failures, failures.join("\n")).toEqual([]);
});

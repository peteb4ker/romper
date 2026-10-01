/**
 * Full-pipeline validation (RE-67; plan: docs/developer/validation-and-traceability.md).
 *
 * Drives the built app through its UI, from nothing: download the factory
 * archive in the setup wizard into a new local store, check the import
 * against the archive, create a kit, link a stereo pair, drop real WAVs onto
 * voices, write to a folder, and compare every card file with what it
 * should be, byte for byte. Every error and warning the app shows or logs is
 * captured; anything not expected below fails the run.
 *
 * Run with `npm run validate:full` (not part of `npm run test:e2e`).
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

import type { ElectronAPI } from "../../shared/electronApi";

import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { ensureFactoryArchive, factoryArchive } from "./support/archive";
import {
  compareCard,
  expectedCardFiles,
  readStore,
  type StoreSnapshot,
} from "./support/card";
import { type Expectation, MessageCollector } from "./support/collector";
import { openFactoryArchive, verifyFactoryImport } from "./support/factory";
import { ValidationReport } from "./support/report";
import { encodeTestWav, sine } from "./support/wav";

const FRESH = process.env.ROMPER_VALIDATE_FRESH === "true";
const REPORT_DIR = path.resolve(
  process.env.ROMPER_VALIDATE_REPORT_DIR ?? "validation-report",
);

/**
 * Messages this run expects, each with its reason. Anything else at warning
 * or error level fails the run.
 */
const EXPECTED: Expectation[] = [
  {
    pattern:
      /^(Debugger (listening|ending) on ws:|For help, see: https:\/\/nodejs\.org)/,
    reason: "Playwright drives the main process through the Node inspector",
    sources: ["main-stderr"],
  },
  {
    pattern: /No local store configured/,
    reason: "the run starts with no local store, so the setup wizard opens",
    sources: ["main-stdout"],
  },
  {
    pattern: /'frame-ancestors' is ignored when delivered via a <meta> element/,
    reason: "frame-ancestors in a <meta> CSP has no effect (register: Low)",
    sources: ["renderer-console"],
  },
  {
    pattern:
      /Failed to set voice alias for kit \w+, voice \d: No local store path configured/,
    reason:
      "voice naming in the setup wizard runs before the store path is saved",
    ref: "RE-34",
    sources: ["renderer-console"],
  },
  {
    pattern:
      /Scan warnings for kit \w+: \[\{"error":"No voice types could be inferred from filenames"/,
    reason:
      "voice names can't be guessed for factory kits whose file names have no drum words (logged as a warning, though it's a normal outcome)",
    sources: ["renderer-console"],
  },
  {
    pattern:
      /Sample has format issues that will require conversion during SD card sync/,
    reason:
      "dropping a 24-bit, 48 kHz or float file notes it will be converted at write",
    sources: ["renderer-console"],
  },
  {
    pattern: /won't fit|over 12|more than 12|were skipped|truncat/i,
    reason: "the factory set has two voices with more than 12 files",
  },
];

/** The new kit's samples: one file each, dropped in this order */
const DROPS: {
  file: string;
  make: () => Buffer;
  voice: number;
}[] = [
  {
    file: "1 stereo pcm16 44k1.wav",
    // A LIST chunk with an odd length: copied byte for byte, chunks and all
    make: () =>
      encodeTestWav(
        [sine(220, 0.4, 44100), sine(330, 0.4, 44100, 0.3)],
        { bitDepth: 16, encoding: "pcm", sampleRate: 44100 },
        { extraChunk: true },
      ),
    voice: 1,
  },
  {
    file: "stereo pcm24 48k.wav",
    make: () =>
      encodeTestWav([sine(440, 0.3, 48000), sine(550, 0.3, 48000, 0.25)], {
        bitDepth: 24,
        encoding: "pcm",
        sampleRate: 48000,
      }),
    voice: 1,
  },
  {
    file: "mono pcm16 44k1.wav",
    make: () =>
      encodeTestWav([sine(110, 0.3, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    voice: 1,
  },
  {
    file: "3 stereo on a mono voice.wav",
    make: () =>
      encodeTestWav([sine(660, 0.3, 44100), sine(880, 0.3, 44100, 0.2)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    voice: 3,
  },
  {
    file: "4 float mono.wav",
    make: () =>
      encodeTestWav([sine(1000, 0.3, 44100, 0.7)], {
        bitDepth: 32,
        encoding: "float",
        sampleRate: 44100,
      }),
    voice: 4,
  },
  {
    file: "4 gain mono.wav",
    make: () =>
      encodeTestWav([sine(150, 0.3, 44100, 0.6)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    voice: 4,
  },
];
const GAIN_DB = 3;

test("[UC-02] [UC-14] [UC-19] [UC-24] [UC-28] [UC-34] factory download to card, byte for byte", async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "romper-validate-"));
  const dirs = {
    card: path.join(work, "card"),
    sources: path.join(work, "sources"),
    store: path.join(work, "store"),
    userData: path.join(work, "user-data"),
  };
  for (const dir of Object.values(dirs))
    await fs.mkdir(dir, { recursive: true });
  await fs.rm(REPORT_DIR, { force: true, recursive: true });
  await fs.mkdir(path.join(REPORT_DIR, "screens"), { recursive: true });

  const report = new ValidationReport(REPORT_DIR, {
    archive: FRESH ? "downloaded from Squarp (--fresh)" : "local copy",
    platform: `${process.platform}-${process.arch}`,
    started: new Date().toISOString(),
    work,
  });
  const collector = new MessageCollector();
  let app: ElectronApplication | undefined;
  let page: Page | undefined;
  let screen = 0;

  // Each step records what the app said and a screenshot
  const step = <T>(name: string, run: () => Promise<T>): Promise<T> =>
    report.step(name, async () => {
      collector.step = name;
      try {
        return await run();
      } finally {
        if (page) {
          await collector.harvest(page);
          const file = `${String(++screen).padStart(2, "0")} ${name}.png`;
          await page
            .screenshot({ path: path.join(REPORT_DIR, "screens", file) })
            .catch(() => {});
        }
      }
    });

  try {
    const archive = await step("Get the factory archive", async () => {
      const cached = await ensureFactoryArchive(FRESH, (l) => report.note(l));
      report.fact(
        "archive",
        `${factoryArchive.fileName} (${factoryArchive.sha256.slice(0, 12)}…)`,
      );
      return cached;
    });

    // The Rample's own settings folder: a write must never touch it
    const saveFile = path.join(dirs.card, "_save", "A0.rpl");
    const saveBytes = Buffer.from("Rample settings: must survive a write\n");
    await fs.mkdir(path.dirname(saveFile), { recursive: true });
    await fs.writeFile(saveFile, saveBytes);

    await step("Launch with a clean profile", async () => {
      app = await electron.launch({
        args: [
          "dist/electron/main/index.js",
          // Never the installed app's settings (RE-68)
          `--user-data-dir=${dirs.userData}`,
          ...(process.env.CI
            ? ["--no-sandbox", "--disable-setuid-sandbox"]
            : []),
        ],
        env: {
          // As a user runs it: no local store override (a clean profile has
          // no store, so the wizard opens by itself)
          ...withoutKeys(process.env, ["ROMPER_LOCAL_PATH"]),
          ROMPER_SDCARD_PATH: dirs.card,
          // --fresh: the app downloads from Squarp itself
          ROMPER_SQUARP_ARCHIVE_URL: FRESH ? "" : archive.fileUrl,
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
    });
    const ui = () => {
      if (!page) throw new Error("no window");
      return page;
    };

    await step(
      "Set up a new local store from the factory archive",
      async () => {
        const p = ui();
        await p.locator('[data-testid="wizard-source-squarp"]').click();
        await p.locator("#local-store-path-input").fill(dirs.store);
        await p.locator('[data-testid="wizard-initialize-btn"]').click();
        const outcome = await Promise.race([
          p
            .locator('[data-testid="wizard-post-init-guidance"]')
            .waitFor({ timeout: 30 * 60_000 })
            .then(() => "guidance"),
          p
            .locator('[data-testid="wizard-error"]')
            .waitFor({ timeout: 30 * 60_000 })
            .then(() => "error"),
          p
            .locator('[data-testid="local-store-wizard"]')
            .waitFor({ state: "hidden", timeout: 30 * 60_000 })
            .then(() => "closed"),
        ]);
        if (outcome === "error") {
          const text = await p
            .locator('[data-testid="wizard-error"]')
            .textContent();
          throw new Error(`Setup failed: ${text}`);
        }
        // The factory set has 7 files over the 12-per-voice limit, so setup
        // should end on guidance that says which were left out
        report.check(
          "setup says which factory samples didn't fit (2 voices over 12)",
          outcome === "guidance" &&
            (await p
              .locator('[data-testid="truncation-warnings"]')
              .isVisible()),
          { details: `wizard ${outcome}`, knownBug: "RE-42" },
        );
        if (outcome === "guidance") {
          await p.locator('[data-testid="post-init-continue-btn"]').click();
        }
        await p
          .locator('[data-testid="kit-grid"]')
          .waitFor({ timeout: 60_000 });
      },
    );

    let factoryStore: StoreSnapshot | undefined;
    await step("Check the import against the archive", async () => {
      factoryStore = readStore(dirs.store);
      report.fact("kits imported", factoryStore.kits.length);
      report.fact("samples imported", factoryStore.samples.length);
      const zip = openFactoryArchive(archive.path);
      await verifyFactoryImport(report, factoryStore, zip);
      const settings = JSON.parse(
        await fs.readFile(
          path.join(dirs.userData, "romper-settings.json"),
          "utf8",
        ),
      ) as { localStorePath?: string };
      report.check(
        "no test-mode banner (the run uses no environment overrides)",
        !(await ui().getByText("Test Mode").isVisible()),
      );
      report.check(
        "the new store is saved in this run's settings, not the installed app's",
        settings.localStorePath === dirs.store,
        { details: `localStorePath: ${settings.localStorePath}` },
      );
    });

    const kit = await step("Create a kit in bank A", async () => {
      const p = ui();
      const before = new Set(readStore(dirs.store).kits);
      await p.locator('[data-testid="add-kit-A"]').click();
      const created = await poll(() => {
        const added = readStore(dirs.store).kits.filter((k) => !before.has(k));
        return added.length === 1 ? added[0] : undefined;
      }, 15_000);
      report.note(`Created ${created}`);
      report.fact("new kit", created);
      const card = p.locator(`[data-testid="kit-item-${created}"]`);
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await p.locator('[data-testid="kit-editor"]').waitFor();
      return created;
    });

    await step("Link voices 1 and 2 as a stereo pair", async () => {
      const p = ui();
      await p.locator('[data-testid="link-button-1-2"]').click();
      await poll(
        () => readStore(dirs.store).stereoVoices.has(`${kit}:1`) || undefined,
        10_000,
      );
      report.check(
        "voice 1 shows the stereo badge",
        await p.locator('[data-testid="stereo-badge-1"]').isVisible(),
      );
    });

    await step("Drop WAV files onto voices", async () => {
      const p = ui();
      for (const drop of DROPS) {
        const file = path.join(dirs.sources, drop.file);
        await fs.writeFile(file, drop.make());
        const count = () =>
          readStore(dirs.store).samples.filter(
            (s) => s.kit_name === kit && s.voice_number === drop.voice,
          ).length;
        const before = count();
        await dropFiles(p, drop.voice, [file]);
        const added = await poll(
          () => (count() > before ? true : undefined),
          15_000,
        ).catch(() => false);
        report.check(
          `"${drop.file}" dropped on voice ${drop.voice} is added`,
          added === true,
        );
      }
      const samples = readStore(dirs.store).samples.filter(
        (s) => s.kit_name === kit,
      );
      report.fact("new kit samples", samples.length);
      report.check(
        "nothing is added to voice 2 while it's linked to voice 1",
        samples.every((s) => s.voice_number !== 2),
      );
    });

    await step(`Set ${GAIN_DB} dB gain on a sample`, async () => {
      const store = readStore(dirs.store);
      const target = store.samples.find(
        (s) => s.kit_name === kit && s.filename === "4 gain mono.wav",
      );
      if (!target) throw new Error("the gain sample wasn't added");
      // The gain knob's own IPC call; dragging the knob isn't reliable here
      const result = await ui().evaluate(
        ([k, v, s, g]) =>
          (
            globalThis as unknown as { electronAPI: ElectronAPI }
          ).electronAPI.updateSampleGain(k, v, s, g),
        [kit, target.voice_number, target.slot_number, GAIN_DB] as const,
      );
      report.check("gain is saved", result.success === true, {
        details: result.error,
      });
      await ui().locator('button[title="Back"]').click();
      await ui().locator('[data-testid="kit-grid"]').waitFor();
    });

    const writeCard = async (expectRemovals: string[]) => {
      const p = ui();
      const store = readStore(dirs.store);
      await p.locator('[data-testid="sync-to-sd-card"]').click();
      await p.locator('[data-testid="sync-dialog"]').waitFor();
      await p
        .locator('[data-testid="bank-summary"]')
        .waitFor({ timeout: 120_000 });
      const total =
        (await p.locator('[data-testid="total-samples"]').textContent()) ?? "";
      report.check(
        `the summary counts ${store.samples.length} samples`,
        total.replaceAll(/\D/g, "") === String(store.samples.length),
        { details: `shows "${total.trim()}"` },
      );
      const removals = p.locator('[data-testid="card-removals"]');
      const removalText = (await removals.isVisible())
        ? ((await removals.textContent()) ?? "")
        : "";
      report.check(
        expectRemovals.length === 0
          ? "the summary lists nothing to remove"
          : `the summary lists ${expectRemovals.join(", ")} for removal`,
        expectRemovals.length === 0
          ? removalText === ""
          : expectRemovals.every((r) => removalText.includes(r)),
        { details: removalText.trim().slice(0, 200) },
      );
      const started = Date.now();
      await p.locator('[data-testid="confirm-sync"]').click();
      const finished = await Promise.race([
        p
          .locator("text=Write Complete")
          .waitFor({ timeout: 20 * 60_000 })
          .then(() => "complete"),
        p
          .locator("text=Write Failed")
          .waitFor({ timeout: 20 * 60_000 })
          .then(() => "failed"),
      ]);
      report.note(
        `Write ${finished} in ${((Date.now() - started) / 1000).toFixed(1)} s`,
      );
      report.check("the write completes", finished === "complete");
      await collector.harvest(p);
      await p.locator('[data-testid="cancel-sync"]').click();
      await p
        .locator('[data-testid="sync-dialog"]')
        .waitFor({ state: "hidden" });
    };

    const compare = async () => {
      const store = readStore(dirs.store);
      const expected = expectedCardFiles(store);
      const counts = await compareCard(report, dirs.card, expected, [
        ...openFactoryArchive(archive.path).bankFiles,
        "_save",
      ]);
      report.fact("card files copied", counts.copied);
      report.fact("card files converted", counts.converted);
      const save = await fs.readFile(saveFile).catch(() => null);
      report.check(
        "the Rample's _save folder is untouched",
        save?.equals(saveBytes) === true,
      );
    };

    await step("Write the store to the card", () => writeCard([]));
    await step("Compare the card with the store", compare);

    await step("Write again: nothing changes", async () => {
      await writeCard([]);
      await compare();
    });

    await step("Delete a sample and write: the card follows", async () => {
      const store = readStore(dirs.store);
      const target = store.samples.find(
        (s) => s.kit_name === kit && s.filename === "4 gain mono.wav",
      );
      if (!target) throw new Error("the gain sample is missing");
      const result = await ui().evaluate(
        ([k, v, s]) =>
          (
            globalThis as unknown as { electronAPI: ElectronAPI }
          ).electronAPI.deleteSampleFromSlot(k, v, s),
        [kit, target.voice_number, target.slot_number] as const,
      );
      report.check("the sample is deleted", result.success === true, {
        details: result.error,
      });
      await writeCard(["gain mono"]);
      await compare();
    });
  } finally {
    if (page) await collector.harvest(page).catch(() => {});
    await app?.close().catch(() => {});
    const classified = collector.classify(EXPECTED);
    await report.write(classified, collector.logs);
    console.log(`Validation report: ${path.join(REPORT_DIR, "report.md")}`);
    if (process.env.ROMPER_VALIDATE_KEEP !== "true") {
      await fs.rm(work, { force: true, recursive: true }).catch(() => {});
    }
  }

  const failures = report.failures(collector.classify(EXPECTED));
  expect(failures, failures.join("\n")).toEqual([]);
});

/** Drop real files on a voice the way a Finder/Explorer drop arrives */
async function dropFiles(page: Page, voice: number, files: string[]) {
  await page.evaluate(() => {
    if (document.getElementById("validation-files")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.id = "validation-files";
    input.style.display = "none";
    document.body.append(input);
  });
  // Files from a real file input carry their paths, so the preload's
  // webUtils.getPathForFile works as it does for an OS drop
  await page.setInputFiles("#validation-files", files);
  await page.evaluate((v) => {
    const input = document.getElementById(
      "validation-files",
    ) as HTMLInputElement;
    const transfer = new DataTransfer();
    for (const file of Array.from(input.files ?? [])) transfer.items.add(file);
    const zone = document.querySelector(`[data-testid="drop-zone-voice-${v}"]`);
    if (!zone) throw new Error(`no drop zone for voice ${v}`);
    for (const type of ["dragenter", "dragover", "drop"]) {
      zone.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      );
    }
  }, voice);
}

async function poll<T>(
  read: () => T | undefined,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() > deadline)
      throw new Error(`timed out after ${timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

function withoutKeys(
  env: NodeJS.ProcessEnv,
  keys: string[],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(
      (e): e is [string, string] => e[1] !== undefined && !keys.includes(e[0]),
    ),
  );
}

/**
 * Performance profile (docs/developer/architecture-review.md).
 *
 * Sets up a factory store through the wizard, then measures what the app
 * does for each common action: which IPC calls it makes, how long main spends
 * in each, how much data comes back, how long the main thread was blocked,
 * and the renderer's long animation frames. Counts are the stable signal;
 * timings depend on the machine and its load, which the report records.
 *
 * Run with `npx playwright test --config playwright.validation.config.ts
 * performance` after `npm run build`. Report: validation-report/performance/.
 *
 * Each action is also checked against its headroom budgets for returned
 * bytes and main-thread stalls (`validation` in tests/perf/budgets.ts). The
 * report lists any failures, and the run fails after writing it.
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

import { type BUDGETS, enforceBudgets } from "../perf/budgets";
import { approveLocalStorePrompts } from "../utils/e2e-dialogs";
import { dropFiles } from "../utils/e2e-drop";
import { ensureFactoryArchive } from "./support/archive";
import { readStore } from "./support/card";
import { encodeTestWav, sine } from "./support/wav";

type Action = Exclude<keyof typeof BUDGETS.validation, "cold start">;

const REPORT_DIR = path.resolve(
  process.env.ROMPER_VALIDATE_REPORT_DIR ?? "validation-report",
  "performance",
);
const PROBE = path.resolve("tests/perf/ipc-probe.cjs");
const COLD_STARTS = 3;

interface Call {
  args: string;
  at: number;
  bytes: number;
  channel: string;
  syncMs: number;
  totalMs: number;
}
interface Frames {
  count: number;
  longestMs: number;
  totalBlockingMs: number;
}
interface Measurement {
  action: Action;
  frames: Frames;
  main: Snapshot;
  wallMs: number;
}
interface Snapshot {
  blocking: { count: number; maxMs: number; p99Ms: number };
  calls: Call[];
}

test("[Q-01] performance profile", async () => {
  test.setTimeout(60 * 60_000);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "romper-perf-"));
  const dirs = {
    card: path.join(work, "card"),
    sources: path.join(work, "sources"),
    store: path.join(work, "store"),
    userData: path.join(work, "user-data"),
  };
  for (const dir of Object.values(dirs))
    await fs.mkdir(dir, { recursive: true });
  await fs.rm(REPORT_DIR, { force: true, recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const archive = await ensureFactoryArchive(false, () => {});
  const measurements: Measurement[] = [];
  const coldStarts: { calls: Call[]; ms: number }[] = [];
  const facts: Record<string, number | string> = {
    cpus: os.cpus().length,
    loadAtStart: os.loadavg()[0].toFixed(1),
    mode: process.env.ROMPER_HEADLESS === "false" ? "headed" : "headless",
    platform: `${process.platform}-${process.arch}`,
  };
  let app: ElectronApplication | undefined;
  let page: Page | undefined;
  let budgetFailures: string[] = [];

  const launch = async () => {
    const started = Date.now();
    app = await electron.launch({
      args: [
        // Electron's own preload flag (it ignores NODE_OPTIONS here)
        "--require",
        PROBE,
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
        ROMPER_SDCARD_PATH: dirs.card,
        ROMPER_SQUARP_ARCHIVE_URL: archive.fileUrl,
        ROMPER_USER_DATA_DIR: dirs.userData,
      },
      timeout: 60_000,
    });
    await approveLocalStorePrompts(app);
    page = await app.firstWindow();
    return started;
  };
  const ui = () => {
    if (!page) throw new Error("no window");
    return page;
  };
  const probe = (): Promise<Snapshot> => {
    if (!app) throw new Error("no app");
    return app.evaluate(() =>
      (
        globalThis as unknown as { __romperProbe: { snapshot(): Snapshot } }
      ).__romperProbe.snapshot(),
    );
  };
  // Long animation frames (>50 ms) in the renderer since the last call
  const watchFrames = () =>
    ui().evaluate(() => {
      const w = globalThis as unknown as { __frames: PerformanceEntry[] };
      w.__frames = [];
      new PerformanceObserver((list) => {
        w.__frames.push(...list.getEntries());
      }).observe({ type: "long-animation-frame" });
    });
  const takeFrames = () =>
    ui().evaluate((): Frames => {
      const w = globalThis as unknown as {
        __frames: ({ blockingDuration?: number } & PerformanceEntry)[];
      };
      const frames = w.__frames.splice(0);
      return {
        count: frames.length,
        longestMs: Math.max(0, ...frames.map((f) => f.duration)),
        totalBlockingMs: frames.reduce(
          (sum, f) => sum + (f.blockingDuration ?? 0),
          0,
        ),
      };
    });
  // Wait until main has had no IPC call for `quietMs`
  const settle = async (quietMs = 750, limitMs = 30_000) => {
    const deadline = Date.now() + limitMs;
    let seen = -1;
    let quietSince = Date.now();
    while (Date.now() < deadline) {
      const count = await app!.evaluate(() =>
        (
          globalThis as unknown as { __romperProbe: { count(): number } }
        ).__romperProbe.count(),
      );
      if (count !== seen) {
        seen = count;
        quietSince = Date.now();
      } else if (Date.now() - quietSince >= quietMs) return;
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const measure = async (action: Action, run: () => Promise<void>) => {
    await settle();
    await probe();
    await takeFrames();
    const started = Date.now();
    await run();
    await settle();
    const wallMs = Date.now() - started;
    measurements.push({
      action,
      frames: await takeFrames(),
      main: await probe(),
      wallMs,
    });
  };

  try {
    // Setup: the wizard imports the factory set (timed as one step)
    await launch();
    await ui().locator('[data-testid="local-store-wizard"]').waitFor();
    const setupStarted = Date.now();
    await ui().locator('[data-testid="wizard-source-squarp"]').click();
    await ui().locator("#local-store-path-input").fill(dirs.store);
    await ui().locator('[data-testid="wizard-initialize-btn"]').click();
    await Promise.race([
      ui()
        .locator('[data-testid="post-init-continue-btn"]')
        .waitFor({ timeout: 30 * 60_000 }),
      ui()
        .locator('[data-testid="local-store-wizard"]')
        .waitFor({ state: "hidden", timeout: 30 * 60_000 }),
    ]);
    facts.setupMs = Date.now() - setupStarted;
    const setup = await probe();
    facts.setupIpcCalls = setup.calls.length;
    facts.setupMainBlockedMaxMs = setup.blocking.maxMs.toFixed(0);
    const store = readStore(dirs.store);
    facts.kits = store.kits.length;
    facts.samples = store.samples.length;
    await app?.close();

    // Cold starts with the saved store
    for (let i = 0; i < COLD_STARTS; i++) {
      const started = await launch();
      await ui()
        .locator('[data-testid="kit-item-A0"]')
        .waitFor({ timeout: 60_000 });
      const ms = Date.now() - started;
      await settle();
      coldStarts.push({ calls: (await probe()).calls, ms });
      if (i < COLD_STARTS - 1) await app?.close();
    }

    await watchFrames();
    const p = ui();

    await measure("idle on the kit grid, 10 s", async () => {
      // The first reading starts the interval the second one covers
      await cpuByType(app!);
      await new Promise((r) => setTimeout(r, 10_000));
      const after = await cpuByType(app!);
      facts.idleRendererCpuPct = after.Tab?.toFixed(1) ?? "n/a";
      facts.idleMainCpuPct = after.Browser?.toFixed(1) ?? "n/a";
    });

    await measure("search: type 'kick'", async () => {
      await p.getByLabel("Search kits").pressSequentially("kick", {
        delay: 120,
      });
    });
    await measure("search: clear", async () => {
      await p.getByLabel("Clear search").click();
    });

    await measure("toggle a favourite", async () => {
      await p
        .locator('[data-testid="kit-item-A0"]')
        .getByTitle("Add to favorites")
        .click();
    });

    await measure("open kit A0", async () => {
      await p.locator('[data-testid="kit-item-A0"]').click();
      await p.locator('[data-testid="kit-editor"]').waitFor();
    });

    await measure("next kit (A1)", async () => {
      await p.keyboard.press(".");
    });
    await measure("previous kit (A0)", async () => {
      await p.keyboard.press(",");
    });

    await measure("enable editing", async () => {
      await p.getByTitle("Enable editable mode").click();
    });

    const wav = path.join(dirs.sources, "perf drop.wav");
    await fs.writeFile(
      wav,
      encodeTestWav([sine(220, 0.5, 44100)], {
        bitDepth: 16,
        encoding: "pcm",
        sampleRate: 44100,
      }),
    );
    await measure("drop a sample on voice 4", async () => {
      await dropFiles(p, 4, [wav]);
    });

    await measure("gain: 10 wheel steps on one knob", async () => {
      const knob = p.getByRole("slider").first();
      await knob.hover();
      for (let i = 0; i < 10; i++) await p.mouse.wheel(0, -100);
    });

    await measure("rename voice 1", async () => {
      await p.getByTitle("Edit voice name").first().click();
      const input = p.locator("input:focus");
      await input.fill("Perf Kick");
      await input.press("Enter");
    });

    await measure("open the sequencer", async () => {
      await p.keyboard.press("s");
      await p.locator('[data-testid="seq-step-0-0"]').waitFor();
    });
    await measure("toggle 4 sequencer steps", async () => {
      for (const step of [0, 4, 8, 12]) {
        await p.locator(`[data-testid="seq-step-0-${step}"]`).click();
      }
    });
    await measure("sequencer playing, 5 s", async () => {
      await p.locator('[data-testid="play-step-sequencer"]').click();
      await new Promise((r) => setTimeout(r, 5_000));
      await p.locator('[data-testid="stop-step-sequencer"]').click();
    });

    await measure("delete a sample", async () => {
      await p.getByTitle("Delete sample").first().click();
    });

    await measure("back to the grid", async () => {
      await p.locator('button[title="Back"]').click();
      await p.locator('[data-testid="kit-grid"]').waitFor();
    });

    await measure("open the write summary", async () => {
      await p.locator('[data-testid="sync-to-sd-card"]').click();
      await p
        .locator('[data-testid="bank-summary"]')
        .waitFor({ timeout: 120_000 });
    });
    facts.loadAtEnd = os.loadavg()[0].toFixed(1);
  } finally {
    await app?.close().catch(() => {});
    budgetFailures = await writeReport(facts, coldStarts, measurements);
    if (process.env.ROMPER_VALIDATE_KEEP !== "true") {
      await fs.rm(work, { force: true, recursive: true }).catch(() => {});
    }
  }
  expect(budgetFailures).toEqual([]);
});

/** CPU use by process type, as a percentage of one core since last call */
async function cpuByType(
  app: ElectronApplication,
): Promise<Record<string, number>> {
  return app.evaluate(({ app: electronApp }) => {
    const out: Record<string, number> = {};
    for (const m of electronApp.getAppMetrics()) {
      out[m.type] = (out[m.type] ?? 0) + m.cpu.percentCPUUsage;
    }
    return out;
  });
}

function summarise(calls: Call[]) {
  const byChannel = new Map<
    string,
    { bytes: number; count: number; maxMs: number; syncMs: number }
  >();
  for (const c of calls) {
    const row = byChannel.get(c.channel) ?? {
      bytes: 0,
      count: 0,
      maxMs: 0,
      syncMs: 0,
    };
    row.count++;
    row.bytes += c.bytes;
    row.syncMs += c.syncMs;
    row.maxMs = Math.max(row.maxMs, c.totalMs);
    byChannel.set(c.channel, row);
  }
  return [...byChannel.entries()].sort((a, b) => b[1].syncMs - a[1].syncMs);
}

const kb = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;

/** Check each action's headroom budgets; returns the failures */
function checkActionBudgets(
  coldStarts: { calls: Call[]; ms: number }[],
  measurements: Measurement[],
): string[] {
  const bytesOf = (calls: Call[]) => calls.reduce((s, c) => s + c.bytes, 0);
  const failures: string[] = [];
  const lastStart = coldStarts.at(-1);
  if (lastStart) {
    failures.push(
      ...enforceBudgets("validation/cold start", {
        bytes: bytesOf(lastStart.calls),
      }),
    );
  }
  for (const m of measurements) {
    failures.push(
      ...enforceBudgets(`validation/${m.action}`, {
        bytes: bytesOf(m.main.calls),
        mainBlockedMs: Math.round(m.main.blocking.maxMs),
      }),
    );
  }
  return failures;
}

async function writeReport(
  facts: Record<string, number | string>,
  coldStarts: { calls: Call[]; ms: number }[],
  measurements: Measurement[],
): Promise<string[]> {
  const budgetFailures = checkActionBudgets(coldStarts, measurements);
  const lines = ["# Performance profile", ""];
  for (const [k, v] of Object.entries(facts)) lines.push(`- ${k}: ${v}`);
  lines.push("", "## Budgets (tests/perf/budgets.ts)", "");
  if (budgetFailures.length === 0) {
    lines.push("Every action is within its budgets.");
  } else {
    for (const failure of budgetFailures) lines.push(`- ${failure}`);
  }
  lines.push("", "## Cold start (launch to first kit card)", "");
  lines.push(
    `Runs: ${coldStarts.map((c) => `${c.ms} ms`).join(", ")}`,
    "",
    "| Channel | Calls | Main-thread ms | Slowest ms | Returned |",
    "|---|---:|---:|---:|---:|",
  );
  for (const [channel, row] of summarise(coldStarts.at(-1)?.calls ?? [])) {
    lines.push(
      `| ${channel} | ${row.count} | ${row.syncMs.toFixed(1)} | ${row.maxMs.toFixed(1)} | ${kb(row.bytes)} |`,
    );
  }
  lines.push(
    "",
    "## Actions",
    "",
    "Wall ms includes the 750 ms quiet period used to tell an action has settled. Handler ms (sync) is main-thread time until each handler's first await; total includes awaited work. Main blocked max is the longest event-loop stall seen during the action.",
    "",
    "| Action | Wall ms | IPC calls | Handler ms (sync) | Handler ms (total) | Main blocked max ms | Returned | Long frames | Longest frame ms |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const m of measurements) {
    const sync = m.main.calls.reduce((s, c) => s + c.syncMs, 0);
    const total = m.main.calls.reduce((s, c) => s + c.totalMs, 0);
    const bytes = m.main.calls.reduce((s, c) => s + c.bytes, 0);
    lines.push(
      `| ${m.action} | ${m.wallMs} | ${m.main.calls.length} | ${sync.toFixed(1)} | ${total.toFixed(1)} | ${m.main.blocking.maxMs.toFixed(0)} | ${kb(bytes)} | ${m.frames.count} | ${m.frames.longestMs.toFixed(0)} |`,
    );
  }
  lines.push("", "## Calls per action", "");
  for (const m of measurements) {
    lines.push(`### ${m.action}`, "");
    const audio = m.main.calls.filter(
      (c) => c.channel === "get-sample-audio-buffer",
    );
    const distinct = new Set(audio.map((c) => c.args)).size;
    if (audio.length > distinct) {
      lines.push(
        `${audio.length} audio-buffer fetches for ${distinct} distinct slots.`,
        "",
      );
    }
    const rows = summarise(m.main.calls);
    if (rows.length === 0) {
      lines.push("No IPC calls.", "");
      continue;
    }
    lines.push(
      "| Channel | Calls | Main-thread ms | Slowest ms | Returned |",
      "|---|---:|---:|---:|---:|",
    );
    for (const [channel, row] of rows) {
      lines.push(
        `| ${channel} | ${row.count} | ${row.syncMs.toFixed(1)} | ${row.maxMs.toFixed(1)} | ${kb(row.bytes)} |`,
      );
    }
    lines.push("");
  }
  await fs.writeFile(path.join(REPORT_DIR, "report.md"), lines.join("\n"));
  await fs.writeFile(
    path.join(REPORT_DIR, "report.json"),
    JSON.stringify(
      { budgetFailures, coldStarts, facts, measurements },
      null,
      2,
    ),
  );
  console.log(`Performance report: ${path.join(REPORT_DIR, "report.md")}`);
  return budgetFailures;
}

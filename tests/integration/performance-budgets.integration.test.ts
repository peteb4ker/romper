/**
 * Performance budgets for main-process operations (tests/perf/budgets.ts).
 *
 * Each operation runs through its real IPC handler on a generated store
 * (three banks of kits with small synthetic WAVs), and the test counts what
 * it costs: better-sqlite3 connections opened and statements run, and for
 * sync planning the synchronous fs calls that hold the main thread. The
 * counts are deterministic, so they're checked on every PR; timings aren't.
 *
 * The instrumentation lives here, not in production code: better-sqlite3 is
 * mocked with a counting subclass of the real driver, and fs's sync
 * functions are wrapped on the module object for the measured call only.
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InMemorySettings } from "../../electron/main/types/settings.js";

import { type BudgetName, enforceBudgets } from "../perf/budgets";
import { encodeTestWav, sine } from "../validation/support/wav";

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const probe = vi.hoisted(() => ({
  counts: { connections: 0, statements: 0 },
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => "/nonexistent",
    getVersion: () => "0.0.0-test",
    isPackaged: false,
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (channel: string, handler: Handler) => {
      probe.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => probe.handlers.delete(channel),
  },
}));

// The real driver, counting connections and statements
vi.mock("better-sqlite3", async (importOriginal) => {
  const Real = (
    await importOriginal<{ default: typeof import("better-sqlite3") }>()
  ).default;
  class CountingDatabase extends Real {
    constructor(...args: ConstructorParameters<typeof Real>) {
      super(...args);
      probe.counts.connections++;
      // Every way a statement reaches SQLite: drizzle prepares each query,
      // transactions and migrations use exec, and pragma bypasses prepare
      const self = this as unknown as Record<
        string,
        (...a: unknown[]) => unknown
      >;
      for (const method of ["exec", "pragma", "prepare"]) {
        const original = self[method].bind(this);
        self[method] = (...a: unknown[]) => {
          probe.counts.statements++;
          return original(...a);
        };
      }
    }
  }
  return { default: CountingDatabase };
});

import {
  addKit,
  getKitSamples,
} from "../../electron/main/db/romperDbCoreORM.js";
import { withDbTransaction } from "../../electron/main/db/utils/dbUtilities.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { pathAccess } from "../../electron/main/security/pathAccess.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { type NewSample, samples } from "../../shared/db/schema.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

const BANKS = ["A", "B", "C"];
/** Setup writes a store (and planning a card); Windows runners are slow */
const SLOW_RUNNER_MS = 60_000;
const KITS_PER_BANK = 2;
const SAMPLES_PER_VOICE = 2;
const SYNC_FS_CALLS = [
  "existsSync",
  "readdirSync",
  "readFileSync",
  "readSync",
  "statSync",
] as const;

let work: string;
let store: string;
let card: string;
let sources: string;
let settings: InMemorySettings;

/** A WAV the user dropped this session */
async function dropped(name: string) {
  const file = path.join(sources, name);
  wav(file, 330);
  await pathAccess.grantRead(file);
  return file;
}

async function expectWithinBudget(
  name: BudgetName,
  run: () => Promise<unknown>,
  metrics: (keyof Awaited<ReturnType<typeof measure>>["counts"])[] = [
    "connections",
    "statements",
  ],
) {
  const { counts, result } = await measure(run);
  expect(result.error).toBeUndefined();
  expect(result.success).toBe(true);
  // Every operation runs SQL, so 0 means the counting mock isn't in place
  expect(counts.statements).toBeGreaterThan(0);
  const measured = Object.fromEntries(metrics.map((m) => [m, counts[m]]));
  expect(enforceBudgets(name, measured)).toEqual([]);
}

/**
 * Three banks of two kits, four voices of two samples each. The samples go
 * in with one transaction, so setup stays fast on slow Windows runners.
 */
function generateStore() {
  const dbDir = path.join(store, ".romperdb");
  expect(createStoreDb(dbDir).success).toBe(true);
  const rows: NewSample[] = [];
  for (const bank of BANKS) {
    for (let k = 0; k < KITS_PER_BANK; k++) {
      const kit = `${bank}${k}`;
      expect(
        addKit(dbDir, {
          alias: null,
          bank_letter: bank,
          editable: true,
          locked: false,
          modified_since_sync: false,
          name: kit,
          step_pattern: null,
        }).success,
      ).toBe(true);
      for (let voice = 1; voice <= 4; voice++) {
        for (let slot = 0; slot < SAMPLES_PER_VOICE; slot++) {
          const filename = `${voice}_${slot}.wav`;
          const file = path.join(store, kit, filename);
          wav(file, 110 * voice + 10 * slot);
          rows.push({
            filename,
            kit_name: kit,
            slot_number: slot,
            source_path: file,
            voice_number: voice,
          });
        }
      }
    }
  }
  expect(
    withDbTransaction(dbDir, (db) => db.insert(samples).values(rows).run())
      .success,
  ).toBe(true);
  return dbDir;
}

async function invoke(channel: string, ...args: unknown[]) {
  const handler = probe.handlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({}, ...args);
}

/** Count what `run` costs: connections, statements and sync fs calls */
async function measure(run: () => Promise<unknown>) {
  const fsCalls = { count: 0 };
  const originals = SYNC_FS_CALLS.map((name) => [name, fs[name]] as const);
  for (const [name, original] of originals) {
    (fs as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      fsCalls.count++;
      return (original as (...a: unknown[]) => unknown)(...args);
    };
  }
  // Named ESM imports of node:fs see the wrappers too
  syncBuiltinESMExports();
  probe.counts.connections = 0;
  probe.counts.statements = 0;
  let result: unknown;
  try {
    result = await run();
  } finally {
    for (const [name, original] of originals) {
      (fs as unknown as Record<string, unknown>)[name] = original;
    }
    syncBuiltinESMExports();
  }
  return {
    counts: {
      connections: probe.counts.connections,
      statements: probe.counts.statements,
      syncFsCalls: fsCalls.count,
    },
    result: result as { data?: unknown; error?: string; success: boolean },
  };
}

function wav(file: string, hz: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    encodeTestWav([sine(hz, 0.05, 44100)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 44100,
    }),
  );
}

describe("[Q-01] performance budgets: main-process operations", () => {
  beforeEach(() => {
    work = createTempStore("romper-budgets-");
    store = path.join(work, "store");
    card = path.join(work, "card");
    sources = path.join(work, "sources");
    fs.mkdirSync(card, { recursive: true });
    generateStore();
    pathAccess.reset();
    probe.handlers.clear();
    settings = { localStorePath: store, sdCardPath: card };
    registerDbIpcHandlers(settings);
    pathAccess.grantRoot(card);
  }, SLOW_RUNNER_MS);

  afterEach(() => {
    pathAccess.reset();
    removeTempStore(work);
  });

  it("add sample", async () => {
    const file = await dropped("added.wav");
    await expectWithinBudget("integration/add sample", () =>
      invoke("add-sample-to-slot", "A0", 1, SAMPLES_PER_VOICE, file),
    );
  });

  it("delete sample (with reindex)", async () => {
    await expectWithinBudget("integration/delete sample", () =>
      invoke("delete-sample-from-slot", "A0", 1, 0),
    );
    const voiceOne = getKitSamples(path.join(store, ".romperdb"), "A0")
      .data?.filter((s) => s.voice_number === 1)
      .map((s) => s.slot_number);
    expect(voiceOne).toEqual([0]);
  });

  it("move sample within a kit", async () => {
    await expectWithinBudget("integration/move sample within a kit", () =>
      invoke("move-sample-in-kit", "A0", 1, 0, 2, 0),
    );
  });

  it("move sample between kits", async () => {
    await expectWithinBudget("integration/move sample between kits", () =>
      invoke("move-sample-between-kits", {
        fromKit: "A0",
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit: "B0",
        toSlot: SAMPLES_PER_VOICE,
        toVoice: 1,
      }),
    );
  });

  it("load a slot's audio", async () => {
    await expectWithinBudget(
      "integration/load a slot's audio",
      () => sampleService.getSampleAudioBuffer(settings, "A0", 2, 1),
      ["connections", "statements", "syncFsCalls"],
    );
  });

  it("get kits", async () => {
    await expectWithinBudget("integration/get kits", () =>
      invoke("get-all-kits"),
    );
  });

  it(
    "plan a sync (write summary)",
    async () => {
      // A card written by an earlier sync, then one edit since
      const written = await syncService.startKitSync(settings, {
        sdCardPath: card,
      });
      expect(written.success).toBe(true);
      await invoke(
        "add-sample-to-slot",
        "B1",
        2,
        SAMPLES_PER_VOICE,
        await dropped("new.wav"),
      );
      // Load anything planning imports lazily, outside the measured call
      await invoke("generateSyncChangeSummary", card);

      await expectWithinBudget(
        "integration/plan a sync (write summary)",
        () => invoke("generateSyncChangeSummary", card),
        ["connections", "statements", "syncFsCalls"],
      );
    },
    SLOW_RUNNER_MS,
  );
  it(
    "[UC-34] planning a sync lets other work run while it reads the files (RE-82)",
    async () => {
      // Load anything planning imports lazily, outside the measured call
      await invoke("generateSyncChangeSummary", card);

      // Count event-loop turns while the summary is planned: a plan that
      // held the main thread would let none through until it finished
      let turns = 0;
      let planning = true;
      const tick = () => {
        if (!planning) return;
        turns++;
        setImmediate(tick);
      };
      setImmediate(tick);
      const summary = (await invoke("generateSyncChangeSummary", card)) as {
        data?: { fileCount: number };
        success: boolean;
      };
      planning = false;

      expect(summary.success).toBe(true);
      expect(summary.data?.fileCount).toBe(
        BANKS.length * KITS_PER_BANK * 4 * SAMPLES_PER_VOICE,
      );
      // At least one turn per batch of samples
      expect(turns).toBeGreaterThanOrEqual(
        (BANKS.length * KITS_PER_BANK * 4 * SAMPLES_PER_VOICE) / 16,
      );
    },
    SLOW_RUNNER_MS,
  );
});

/**
 * Undoing or redoing a sequencer edit puts the steps, trigger conditions
 * and slices back in one write: if one part fails, none of them change
 * (#570).
 *
 * Calls the real `restore-kit-sequence` handler on a real store. Fault
 * injection uses a SQLite trigger (RAISE(ABORT)) on the kit's slices.
 */
import type { SliceStep } from "@romper/shared/sliceTypes.js";

import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/nonexistent", isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

import { ipcMain } from "electron";

import {
  addKit,
  getKit,
  updateKit,
  withDbTransaction,
} from "../../electron/main/db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../../electron/main/dbIpcHandlers.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

type Handler = (
  event: object,
  ...args: unknown[]
) => Promise<{ error?: string; success: boolean }>;

let store: string;
let dbDir: string;

const SLICE: SliceStep = {
  length: 24,
  locked: false,
  random: false,
  start: 48,
};

function grid<T>(fill: T): T[][] {
  return Array.from({ length: 4 }, () => new Array<T>(16).fill(fill));
}

function handlerFor(channel: string): Handler {
  const call = vi
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel);
  expect(call).toBeDefined();
  return call?.[1] as unknown as Handler;
}

function sequence() {
  const kit = getKit(dbDir, "A0").data;
  return {
    sliceSteps: kit?.slice_steps,
    stepPattern: kit?.step_pattern,
    triggerConditions: kit?.trigger_conditions,
  };
}

beforeEach(() => {
  vi.mocked(ipcMain.handle).mockClear();
  store = createTempStore("romper-sequence-undo-");
  dbDir = path.join(store, ".romperdb");
  expect(createStoreDb(dbDir).success).toBe(true);
  expect(
    addKit(dbDir, {
      bank_letter: "A",
      editable: true,
      modified_since_sync: false,
      name: "A0",
    }).success,
  ).toBe(true);
  expect(
    updateKit(dbDir, "A0", {
      slice_steps: grid(null),
      step_pattern: grid(0),
      trigger_conditions: grid(null),
    }).success,
  ).toBe(true);
  registerDbIpcHandlers({ localStorePath: store });
});

afterEach(() => {
  removeTempStore(store);
});

describe("[UC-26] [Q-02] undoing a sequencer edit (#570)", () => {
  it("puts the steps, conditions and slices back together", async () => {
    const stepPattern = grid(0);
    stepPattern[0][0] = 127;
    const triggerConditions = grid<null | string>(null);
    triggerConditions[0][0] = "1:2";
    const sliceSteps = grid<null | SliceStep>(null);
    sliceSteps[0][0] = SLICE;

    const result = await handlerFor("restore-kit-sequence")({}, "A0", {
      sliceSteps,
      stepPattern,
      triggerConditions,
    });

    expect(result).toEqual({ success: true });
    expect(sequence()).toEqual({
      sliceSteps,
      stepPattern,
      triggerConditions,
    });
  });

  it("changes nothing when one part fails", async () => {
    const before = sequence();
    withDbTransaction(dbDir, (_db, sqlite) =>
      sqlite.exec(
        "CREATE TRIGGER no_slices BEFORE UPDATE OF slice_steps ON kits BEGIN SELECT RAISE(ABORT, 'injected fault'); END",
      ),
    );
    const stepPattern = grid(0);
    stepPattern[1][4] = 100;
    const triggerConditions = grid<null | string>(null);
    triggerConditions[1][4] = "!1:2";
    const sliceSteps = grid<null | SliceStep>(null);
    sliceSteps[1][4] = SLICE;

    const result = await handlerFor("restore-kit-sequence")({}, "A0", {
      sliceSteps,
      stepPattern,
      triggerConditions,
    });

    expect(result.success).toBe(false);
    expect(sequence()).toEqual(before);
  });

  it("refuses a part that isn't a grid, writing none of them", async () => {
    const before = sequence();
    const stepPattern = grid(0);
    stepPattern[2][2] = 64;

    const result = await handlerFor("restore-kit-sequence")({}, "A0", {
      stepPattern,
      triggerConditions: "not a grid",
    });

    expect(result).toEqual({
      error: "No sequence to restore",
      success: false,
    });
    expect(sequence()).toEqual(before);
  });
});

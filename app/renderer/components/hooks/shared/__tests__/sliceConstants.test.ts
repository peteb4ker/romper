import {
  SLICE_TICKS,
  SLICER_DIVISIONS,
  type SliceStep,
} from "@romper/shared/sliceTypes";
import { describe, expect, it } from "vitest";

import {
  createEmptySliceSteps,
  ensureValidSliceSteps,
  makeSliceStep,
  nudgeLengthSlices,
  nudgeStartSlice,
  resolveTriggeredSlice,
  rollSliceRow,
  sequentialSliceStep,
  setLengthSlices,
  setStartSlice,
  sliceRegion,
  toSliceView,
} from "../sliceConstants";

/** Deterministic RNG that replays the given values in a loop. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const allOn = new Array(16).fill(true);

describe("sliceConstants", () => {
  describe("tick <-> slice conversion", () => {
    it.each(SLICER_DIVISIONS)(
      "round-trips every slice boundary at /%i",
      (division) => {
        for (let slice = 0; slice < division; slice++) {
          const step = makeSliceStep(slice, 1, division);
          expect(Number.isInteger(step.start)).toBe(true);
          expect(toSliceView(step, division)).toEqual({
            lengthSlices: 1,
            startSlice: slice,
          });
        }
      },
    );

    it("changing the division and back restores the original pattern", () => {
      const original = makeSliceStep(5, 2, 16); // slice 6 of 16, 2 long
      const at12 = toSliceView(original, 12);
      expect(at12.startSlice).toBe(3); // floors to the nearest /12 boundary
      // Stored ticks are untouched, so /16 reads back exactly
      expect(toSliceView(original, 16)).toEqual({
        lengthSlices: 2,
        startSlice: 5,
      });
    });

    it("never reports a length below one slice", () => {
      const tiny: SliceStep = {
        length: 3,
        locked: false,
        random: false,
        start: 0,
      };
      expect(toSliceView(tiny, 8).lengthSlices).toBe(1);
    });
  });

  describe("makeSliceStep", () => {
    it("clamps length so it never runs past the sample end", () => {
      const step = makeSliceStep(14, 8, 16);
      expect(toSliceView(step, 16)).toEqual({
        lengthSlices: 2,
        startSlice: 14,
      });
    });

    it("keeps lock and random flags", () => {
      const step = makeSliceStep(0, 1, 16, { locked: true, random: true });
      expect(step.locked).toBe(true);
      expect(step.random).toBe(true);
    });

    it("stores a full-sample length as SLICE_TICKS", () => {
      expect(makeSliceStep(0, 16, 16)).toHaveLength(SLICE_TICKS);
    });
  });

  describe("editing", () => {
    it("setStartSlice keeps the length where it fits", () => {
      const step = makeSliceStep(0, 3, 16);
      expect(toSliceView(setStartSlice(step, 4, 16), 16)).toEqual({
        lengthSlices: 3,
        startSlice: 4,
      });
      expect(toSliceView(setStartSlice(step, 15, 16), 16)).toEqual({
        lengthSlices: 1,
        startSlice: 15,
      });
    });

    it("setLengthSlices clamps between 1 and the slices left", () => {
      const step = makeSliceStep(12, 1, 16);
      expect(toSliceView(setLengthSlices(step, 0, 16), 16).lengthSlices).toBe(
        1,
      );
      expect(toSliceView(setLengthSlices(step, 9, 16), 16).lengthSlices).toBe(
        4,
      );
    });

    it("nudgeStartSlice wraps round the sample", () => {
      const last = makeSliceStep(15, 1, 16);
      expect(toSliceView(nudgeStartSlice(last, 1, 16), 16).startSlice).toBe(0);
      const first = makeSliceStep(0, 1, 16);
      expect(toSliceView(nudgeStartSlice(first, -1, 16), 16).startSlice).toBe(
        15,
      );
    });

    it("nudgeLengthSlices grows and shrinks the length", () => {
      const step = makeSliceStep(0, 2, 16);
      expect(toSliceView(nudgeLengthSlices(step, 1, 16), 16).lengthSlices).toBe(
        3,
      );
      expect(
        toSliceView(nudgeLengthSlices(step, -5, 16), 16).lengthSlices,
      ).toBe(1);
    });
  });

  describe("sequential defaults", () => {
    it("maps step n to slice n", () => {
      expect(toSliceView(sequentialSliceStep(5, 16), 16)).toEqual({
        lengthSlices: 1,
        startSlice: 5,
      });
    });

    it("wraps when there are fewer slices than steps", () => {
      expect(toSliceView(sequentialSliceStep(9, 8), 8).startSlice).toBe(1);
    });
  });

  describe("sliceRegion", () => {
    it("returns start and length as fractions of the sample", () => {
      expect(sliceRegion({ lengthSlices: 1, startSlice: 4 }, 16)).toEqual({
        length: 1 / 16,
        start: 0.25,
      });
    });

    it("clips a region that would run past the sample end", () => {
      expect(sliceRegion({ lengthSlices: 4, startSlice: 14 }, 16)).toEqual({
        length: 2 / 16,
        start: 14 / 16,
      });
    });
  });

  describe("resolveTriggeredSlice", () => {
    const settings = { maxLength: 4, varyLength: false };

    it("plays the stored slice", () => {
      const step = makeSliceStep(9, 2, 16);
      expect(resolveTriggeredSlice(step, 0, 16, settings)).toEqual({
        lengthSlices: 2,
        startSlice: 9,
      });
    });

    it("falls back to the sequential default when a step has no data", () => {
      expect(resolveTriggeredSlice(null, 6, 16, settings)).toEqual({
        lengthSlices: 1,
        startSlice: 6,
      });
    });

    it("picks a fresh random slice for live-random steps", () => {
      const step = makeSliceStep(0, 2, 16, { random: true });
      expect(resolveTriggeredSlice(step, 0, 16, settings, seq(0.5))).toEqual({
        lengthSlices: 2,
        startSlice: 8,
      });
    });

    it("also varies length for live-random steps when asked", () => {
      const step = makeSliceStep(0, 1, 16, { random: true });
      const view = resolveTriggeredSlice(
        step,
        0,
        16,
        { maxLength: 4, varyLength: true },
        seq(0.1, 0.99),
      );
      expect(view).toEqual({ lengthSlices: 4, startSlice: 1 });
    });
  });

  describe("rollSliceRow", () => {
    const options = {
      amount: 100,
      division: 16,
      maxLength: 2,
      varyLength: false,
    };

    it("only rolls active, unlocked, non-random steps", () => {
      const row = new Array<null | SliceStep>(16).fill(null);
      row[0] = makeSliceStep(0, 1, 16, { locked: true });
      row[1] = makeSliceStep(1, 1, 16, { random: true });
      row[2] = makeSliceStep(2, 1, 16);
      const active = new Array(16).fill(false);
      active[0] = active[1] = active[2] = true;

      const { rolled, row: next } = rollSliceRow(
        row,
        active,
        options,
        seq(0.99),
      );
      expect(rolled).toEqual([2]);
      expect(next[0]).toBe(row[0]);
      expect(next[1]).toBe(row[1]);
      expect(toSliceView(next[2]!, 16).startSlice).toBe(15);
      expect(next[3]).toBeNull();
    });

    it("rolls the given percentage of eligible steps, at least one", () => {
      const row = createEmptySliceSteps()[0];
      expect(
        rollSliceRow(row, allOn, { ...options, amount: 25 }, seq(0.3)).rolled,
      ).toHaveLength(4);
      const oneActive = new Array(16).fill(false);
      oneActive[3] = true;
      expect(
        rollSliceRow(row, oneActive, { ...options, amount: 25 }, seq(0.3))
          .rolled,
      ).toEqual([3]);
    });

    it("keeps lengths unless vary length is on", () => {
      const row = new Array<null | SliceStep>(16).fill(null);
      row[0] = makeSliceStep(0, 3, 16);
      const active = new Array(16).fill(false);
      active[0] = true;

      const kept = rollSliceRow(row, active, options, seq(0.1)).row;
      expect(toSliceView(kept[0]!, 16).lengthSlices).toBe(3);

      const varied = rollSliceRow(
        row,
        active,
        { ...options, maxLength: 2, varyLength: true },
        seq(0.1, 0.1, 0.1),
      ).row;
      expect(toSliceView(varied[0]!, 16).lengthSlices).toBe(1);
    });

    it("preserves the lock flag of rolled steps", () => {
      const row = new Array<null | SliceStep>(16).fill(null);
      const active = new Array(16).fill(false);
      active[0] = true;
      const { row: next } = rollSliceRow(row, active, options, seq(0.5));
      expect(next[0]).toMatchObject({ locked: false, random: false });
    });

    it("returns the same row when nothing is eligible", () => {
      const row = createEmptySliceSteps()[0];
      const result = rollSliceRow(row, new Array(16).fill(false), options);
      expect(result.rolled).toEqual([]);
      expect(result.row).toBe(row);
    });
  });

  describe("ensureValidSliceSteps", () => {
    it("returns an empty 4x16 grid for missing data", () => {
      expect(ensureValidSliceSteps(null)).toEqual(createEmptySliceSteps());
    });

    it("drops malformed cells and clamps ticks", () => {
      const grid = ensureValidSliceSteps([
        [{ length: 9999, start: -5 }, "junk", { start: 10 }],
      ]);
      expect(grid).toHaveLength(4);
      expect(grid[0][0]).toEqual({
        length: SLICE_TICKS,
        locked: false,
        random: false,
        start: 0,
      });
      expect(grid[0][1]).toBeNull();
      expect(grid[0][2]).toBeNull();
      expect(grid[3]).toHaveLength(16);
    });
  });
});

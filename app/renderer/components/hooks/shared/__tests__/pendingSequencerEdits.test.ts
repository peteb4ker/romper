import type { DbResult, KitEdit } from "@romper/shared/db/schema";

import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import {
  createDefaultStepPattern,
  createDefaultTriggerConditions,
} from "../stepPatternConstants";
import { useStepPattern } from "../useStepPattern";
import { useTriggerConditions } from "../useTriggerConditions";

type Answer = () => void;

/**
 * Main as the sequencer sees it: each save is written when it's sent, in
 * order, and answered with the kit as that write left it (#777), but only
 * when the test answers it
 */
function fakeMain() {
  let kit: KitEdit = createMockKitWithRelations({
    name: "A0",
    step_pattern: createDefaultStepPattern(),
    trigger_conditions: createDefaultTriggerConditions(),
  });
  const answers: Answer[] = [];
  const write = (change: Partial<KitEdit>) => {
    kit = { ...kit, ...change };
    const returned = kit;
    return new Promise<DbResult<KitEdit>>((resolve) => {
      answers.push(() => resolve({ data: returned, success: true }));
    });
  };
  vi.mocked(globalThis.electronAPI.updateStepPattern).mockImplementation(
    (_kit, step_pattern) => write({ step_pattern }) as never,
  );
  vi.mocked(globalThis.electronAPI.updateTriggerConditions).mockImplementation(
    (_kit, trigger_conditions) => write({ trigger_conditions }) as never,
  );
  return { answers, initial: kit };
}

/** The steps and conditions of one kit, shown from what each save returns */
function useSequencer(initial: KitEdit) {
  const [kit, setKit] = React.useState(initial);
  const show = React.useCallback((edited?: KitEdit) => {
    if (edited) setKit(edited);
  }, []);
  const steps = useStepPattern({
    initialPattern: kit.step_pattern,
    kitName: "A0",
    onSaved: show,
  });
  const conditions = useTriggerConditions({
    initialConditions: kit.trigger_conditions,
    kitName: "A0",
    onSaved: show,
  });
  return { conditions, steps };
}

function withCondition(conditions: (null | string)[][], step: number) {
  return conditions.map((row, v) =>
    v === 0 ? row.map((c, s) => (s === step ? "1:2" : c)) : row,
  );
}

function withStep(pattern: number[][], step: number) {
  return pattern.map((row, v) =>
    v === 0 ? row.map((velocity, s) => (s === step ? 127 : velocity)) : row,
  );
}

// Edits of one kit save in order; each save returns the kit, which can
// arrive while a later edit of the kit is still saving (#778)
describe("[UC-30] [UC-31] [Q-01] sequencer edits still saving stay on screen (#778)", () => {
  beforeEach(() => {
    setupElectronAPIMock();
  });

  it("keeps a step on while it saves, when a condition's save returns the kit without it", async () => {
    const { answers, initial } = fakeMain();
    const { result } = renderHook(() => useSequencer(initial));

    // Step 1 on, a condition on step 3, then step 2 on: three saves
    act(() => {
      void result.current.steps.setStepPattern(
        withStep(result.current.steps.stepPattern ?? [], 0),
      );
    });
    act(() => {
      void result.current.conditions.setTriggerConditions(
        withCondition(result.current.conditions.triggerConditions, 2),
      );
    });
    act(() => {
      void result.current.steps.setStepPattern(
        withStep(result.current.steps.stepPattern ?? [], 1),
      );
    });

    // Step 1's save, then the condition's, which returns the kit without
    // step 2
    await act(async () => {
      answers[0]();
      answers[1]();
    });
    expect(result.current.steps.stepPattern?.[0].slice(0, 3)).toEqual([
      127, 127, 0,
    ]);
    expect(result.current.conditions.triggerConditions[0][2]).toBe("1:2");

    await act(async () => {
      answers[2]();
    });
    expect(result.current.steps.stepPattern?.[0].slice(0, 3)).toEqual([
      127, 127, 0,
    ]);
    expect(result.current.conditions.triggerConditions[0][2]).toBe("1:2");
  });

  it("keeps a condition while it saves, when a step's save returns the kit without it", async () => {
    const { answers, initial } = fakeMain();
    const { result } = renderHook(() => useSequencer(initial));

    act(() => {
      void result.current.conditions.setTriggerConditions(
        withCondition(result.current.conditions.triggerConditions, 0),
      );
    });
    act(() => {
      void result.current.steps.setStepPattern(
        withStep(result.current.steps.stepPattern ?? [], 0),
      );
    });
    act(() => {
      void result.current.conditions.setTriggerConditions(
        withCondition(result.current.conditions.triggerConditions, 1),
      );
    });

    // The step's save returns the kit with the first condition only
    await act(async () => {
      answers[0]();
      answers[1]();
    });
    expect(result.current.conditions.triggerConditions[0].slice(0, 2)).toEqual([
      "1:2",
      "1:2",
    ]);

    await act(async () => {
      answers[2]();
    });
    expect(result.current.conditions.triggerConditions[0].slice(0, 2)).toEqual([
      "1:2",
      "1:2",
    ]);
    expect(result.current.steps.stepPattern?.[0][0]).toBe(127);
  });
});

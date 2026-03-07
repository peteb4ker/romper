import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VoiceVuState } from "../useLedVisualization";

import { clearAllLevels, setVoiceLevel } from "../audioLevels";
import {
  ICON_LED_COUNT,
  ICON_MAX_RIPPLES,
  ICON_ROWS,
} from "../ledIconConstants";
import {
  computeVoiceBar,
  computeVuLedBrightness,
  decayPeak,
  getVuState,
  initVuState,
  updateCrossFade,
  updatePeakState,
  useLedVisualization,
} from "../useLedVisualization";
import {
  VU_CROSSFADE_MS,
  VU_DECAY_RATE,
  VU_LIT_MAX_BRIGHTNESS,
  VU_LIT_MIN_BRIGHTNESS,
  VU_NOISE_FLOOR,
  VU_PEAK_BRIGHTNESS,
  VU_PEAK_DROP_INTERVAL,
  VU_PEAK_HOLD_FRAMES,
  VU_SILENCE_THRESHOLD,
  VU_UNLIT_BRIGHTNESS,
} from "../vuMeterConstants";

describe("useLedVisualization", () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllLevels();
    rafCallbacks = [];
    rafId = 0;

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "#e05a60",
    } as unknown as CSSStyleDeclaration);

    global.requestAnimationFrame = vi.fn((cb) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    global.cancelAnimationFrame = vi.fn();
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllLevels();
  });

  const createIsHoveredRef = (value = false) => ({ current: value });

  it("returns ledRefs, setMousePosition, clearMousePosition, and addRipple", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useLedVisualization(isHoveredRef));
    expect(result.current.ledRefs).toBeDefined();
    expect(result.current.setMousePosition).toBeInstanceOf(Function);
    expect(result.current.clearMousePosition).toBeInstanceOf(Function);
    expect(result.current.addRipple).toBeInstanceOf(Function);
  });

  it("starts RAF on mount", () => {
    const isHoveredRef = createIsHoveredRef();
    renderHook(() => useLedVisualization(isHoveredRef));
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it("cancels RAF on unmount", () => {
    const isHoveredRef = createIsHoveredRef();
    const { unmount } = renderHook(() => useLedVisualization(isHoveredRef));
    unmount();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("updates LED opacity in animation frame", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useLedVisualization(isHoveredRef));
    const mockLeds = Array.from({ length: ICON_LED_COUNT }, () => {
      const el = document.createElement("div");
      el.style.opacity = "0.2";
      el.style.boxShadow = "none";
      el.style.backgroundColor = "";
      return el;
    });
    result.current.ledRefs.current = mockLeds;
    vi.spyOn(performance, "now").mockReturnValue(1000);
    if (rafCallbacks.length > 0) {
      rafCallbacks[rafCallbacks.length - 1](1000);
    }
    const opacities = mockLeds.map((el) => parseFloat(el.style.opacity));
    const hasVariation = opacities.some((o) => o !== 0.2);
    expect(hasVariation).toBe(true);
  });

  it("caps ripples at ICON_MAX_RIPPLES", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useLedVisualization(isHoveredRef));
    for (let i = 0; i < ICON_MAX_RIPPLES + 5; i++) {
      vi.spyOn(performance, "now").mockReturnValue(i * 100);
      result.current.addRipple(i, i);
    }
    expect(() => result.current.addRipple(0, 0)).not.toThrow();
  });

  it("renders VU mode when voices are active", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useLedVisualization(isHoveredRef));
    const mockLeds = Array.from({ length: ICON_LED_COUNT }, () => {
      const el = document.createElement("div");
      el.style.opacity = "0.2";
      el.style.boxShadow = "none";
      el.style.backgroundColor = "";
      return el;
    });
    result.current.ledRefs.current = mockLeds;

    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });

    vi.spyOn(performance, "now").mockReturnValue(100);
    if (rafCallbacks.length > 0) {
      rafCallbacks[rafCallbacks.length - 1](100);
    }
    // Run a second frame so cross-fade kicks in
    vi.spyOn(performance, "now").mockReturnValue(200);
    const lastCb = rafCallbacks[rafCallbacks.length - 1];
    if (lastCb) lastCb(200);

    // Voice 1 columns (1,2,3) should have backgroundColor set
    const voice1Led = mockLeds[1]; // col 1, row 0
    expect(voice1Led.style.backgroundColor).not.toBe("");
  });
});

describe("initVuState", () => {
  it("returns default state", () => {
    const state = initVuState();
    expect(state).toEqual({
      peakDropCounter: 0,
      peakHoldCounter: 0,
      peakRow: -1,
      smoothedLevel: 0,
    });
  });
});

describe("getVuState", () => {
  it("creates state for new voice", () => {
    const states: Record<number, VoiceVuState> = {};
    const state = getVuState(states, 1);
    expect(state.smoothedLevel).toBe(0);
    expect(states[1]).toBe(state);
  });

  it("returns existing state", () => {
    const existing = initVuState();
    existing.smoothedLevel = 0.5;
    const states: Record<number, VoiceVuState> = { 1: existing };
    const state = getVuState(states, 1);
    expect(state).toBe(existing);
    expect(state.smoothedLevel).toBe(0.5);
  });
});

describe("computeVoiceBar", () => {
  afterEach(() => {
    clearAllLevels();
  });

  it("returns 0 when no voice level is set", () => {
    const state = initVuState();
    const height = computeVoiceBar(state, 1);
    expect(height).toBe(0);
  });

  it("returns 0 when level is below noise floor", () => {
    setVoiceLevel(1, { isStereo: false, left: VU_NOISE_FLOOR * 0.5, right: 0 });
    const state = initVuState();
    const height = computeVoiceBar(state, 1);
    expect(height).toBe(0);
  });

  it("returns positive height for audible level", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.5, right: 0.5 });
    const state = initVuState();
    const height = computeVoiceBar(state, 1);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(ICON_ROWS);
  });

  it("clamps to ICON_ROWS max", () => {
    setVoiceLevel(1, { isStereo: false, left: 1.0, right: 1.0 });
    const state = initVuState();
    const height = computeVoiceBar(state, 1);
    expect(height).toBeLessThanOrEqual(ICON_ROWS);
  });

  it("applies decay when level drops", () => {
    setVoiceLevel(1, { isStereo: false, left: 0.8, right: 0.8 });
    const state = initVuState();
    computeVoiceBar(state, 1);
    const prevSmoothed = state.smoothedLevel;

    // Drop level to 0
    clearAllLevels();
    computeVoiceBar(state, 1);
    // smoothedLevel should have decayed but not instantly to 0
    expect(state.smoothedLevel).toBeCloseTo(prevSmoothed * VU_DECAY_RATE, 5);
  });

  it("uses max of left and right channels", () => {
    setVoiceLevel(1, { isStereo: true, left: 0.2, right: 0.8 });
    const state = initVuState();
    computeVoiceBar(state, 1);
    expect(state.smoothedLevel).toBe(0.8);
  });
});

describe("computeVuLedBrightness", () => {
  it("returns VU_UNLIT_BRIGHTNESS for unlit row", () => {
    const brightness = computeVuLedBrightness(0, 0, -1);
    expect(brightness).toBe(VU_UNLIT_BRIGHTNESS);
  });

  it("returns VU_PEAK_BRIGHTNESS for peak row", () => {
    const brightness = computeVuLedBrightness(2, 3, 2);
    expect(brightness).toBe(VU_PEAK_BRIGHTNESS);
  });

  it("returns brightness in lit range for lit rows", () => {
    // barHeight=3 means rows 2,3,4 are lit (ICON_ROWS=5)
    const brightness = computeVuLedBrightness(3, 3, -1);
    expect(brightness).toBeGreaterThanOrEqual(VU_LIT_MIN_BRIGHTNESS);
    expect(brightness).toBeLessThanOrEqual(VU_LIT_MAX_BRIGHTNESS);
  });

  it("returns higher brightness toward top of bar", () => {
    // barHeight=5 means all rows lit
    const topBrightness = computeVuLedBrightness(0, 5, -1);
    const bottomBrightness = computeVuLedBrightness(4, 5, -1);
    expect(topBrightness).toBeGreaterThan(bottomBrightness);
  });

  it("does not treat negative peakRow as peak", () => {
    const brightness = computeVuLedBrightness(0, 0, -1);
    expect(brightness).toBe(VU_UNLIT_BRIGHTNESS);
  });
});

describe("updatePeakState", () => {
  it("initializes peak when bar first appears", () => {
    const state = initVuState();
    updatePeakState(state, 3);
    expect(state.peakRow).toBe(ICON_ROWS - Math.ceil(3));
    expect(state.peakHoldCounter).toBe(VU_PEAK_HOLD_FRAMES);
  });

  it("resets hold when peak reaches higher", () => {
    const state = initVuState();
    state.peakRow = 3;
    state.peakHoldCounter = 2;
    updatePeakState(state, 4); // higher bar → lower row number
    expect(state.peakRow).toBe(ICON_ROWS - Math.ceil(4));
    expect(state.peakHoldCounter).toBe(VU_PEAK_HOLD_FRAMES);
  });

  it("decays peak when bar drops", () => {
    const state = initVuState();
    state.peakRow = 1;
    state.peakHoldCounter = 0;
    state.peakDropCounter = 0;
    updatePeakState(state, 0.5); // bar much lower than peak
    // Should have called decayPeak
    expect(state.peakDropCounter).toBe(1);
  });

  it("does nothing when barHeight is 0 and no peak", () => {
    const state = initVuState();
    updatePeakState(state, 0);
    expect(state.peakRow).toBe(-1);
  });
});

describe("decayPeak", () => {
  it("decrements hold counter when positive", () => {
    const state = initVuState();
    state.peakRow = 2;
    state.peakHoldCounter = 5;
    decayPeak(state);
    expect(state.peakHoldCounter).toBe(4);
    expect(state.peakRow).toBe(2);
  });

  it("drops peak after hold expires", () => {
    const state = initVuState();
    state.peakRow = 2;
    state.peakHoldCounter = 0;
    state.peakDropCounter = VU_PEAK_DROP_INTERVAL - 1;
    decayPeak(state);
    expect(state.peakRow).toBe(3);
    expect(state.peakDropCounter).toBe(0);
  });

  it("resets peak when it falls off bottom", () => {
    const state = initVuState();
    state.peakRow = ICON_ROWS - 1;
    state.peakHoldCounter = 0;
    state.peakDropCounter = VU_PEAK_DROP_INTERVAL - 1;
    decayPeak(state);
    expect(state.peakRow).toBe(-1);
  });

  it("increments drop counter without dropping if interval not reached", () => {
    const state = initVuState();
    state.peakRow = 2;
    state.peakHoldCounter = 0;
    state.peakDropCounter = 0;
    decayPeak(state);
    expect(state.peakDropCounter).toBe(1);
    expect(state.peakRow).toBe(2);
  });
});

describe("updateCrossFade", () => {
  it("sets ambientFade to 0 when VU is active", () => {
    const cf = { ambientFade: 1, vuInactiveSince: null, wasVuActive: false };
    updateCrossFade(cf, true, 1.0, {});
    expect(cf.ambientFade).toBe(0);
    expect(cf.wasVuActive).toBe(true);
  });

  it("sets ambientFade to 1 when never active", () => {
    const cf = { ambientFade: 0, vuInactiveSince: null, wasVuActive: false };
    updateCrossFade(cf, false, 1.0, {});
    expect(cf.ambientFade).toBe(1);
  });

  it("starts cross-fade when all voices decayed", () => {
    const states = { 1: { ...initVuState(), smoothedLevel: 0 } };
    const cf = { ambientFade: 0, vuInactiveSince: null, wasVuActive: true };
    updateCrossFade(cf, false, 1.0, states);
    expect(cf.vuInactiveSince).toBe(1.0);
    expect(cf.ambientFade).toBe(0); // just started
  });

  it("progresses cross-fade over time", () => {
    const states = { 1: { ...initVuState(), smoothedLevel: 0 } };
    const cf = { ambientFade: 0, vuInactiveSince: 1.0, wasVuActive: true };
    // Advance by half the crossfade duration
    const halfwayTime = 1.0 + VU_CROSSFADE_MS / 2000;
    updateCrossFade(cf, false, halfwayTime, states);
    expect(cf.ambientFade).toBeCloseTo(0.5, 1);
  });

  it("completes cross-fade and resets state", () => {
    const states = { 1: { ...initVuState(), smoothedLevel: 0 } };
    const cf = { ambientFade: 0, vuInactiveSince: 1.0, wasVuActive: true };
    const doneTime = 1.0 + VU_CROSSFADE_MS / 1000 + 0.1;
    updateCrossFade(cf, false, doneTime, states);
    expect(cf.ambientFade).toBe(1);
    expect(cf.wasVuActive).toBe(false);
    expect(cf.vuInactiveSince).toBeNull();
  });

  it("does not cross-fade if voices still decaying", () => {
    const states = {
      1: { ...initVuState(), smoothedLevel: VU_SILENCE_THRESHOLD + 0.01 },
    };
    const cf = { ambientFade: 0, vuInactiveSince: null, wasVuActive: true };
    updateCrossFade(cf, false, 1.0, states);
    expect(cf.ambientFade).toBe(0); // no change
    expect(cf.vuInactiveSince).toBeNull();
  });
});

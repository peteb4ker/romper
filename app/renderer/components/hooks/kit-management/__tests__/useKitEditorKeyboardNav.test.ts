import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKitEditorKeyboardNav } from "../useKitEditorKeyboardNav";

function setActiveElement(el: Element | null): void {
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    value: el,
  });
}

/** Capture the keydown handler the hook registers on globalThis. */
function setup(overrides = {}) {
  const handlers: Array<(e: KeyboardEvent) => void> = [];
  const addSpy = vi
    .spyOn(globalThis, "addEventListener")
    .mockImplementation((type, listener) => {
      if (type === "keydown") {
        handlers.push(listener as (e: KeyboardEvent) => void);
      }
    });
  const removeSpy = vi
    .spyOn(globalThis, "removeEventListener")
    .mockImplementation(() => {});

  const props = {
    isEditable: false,
    onInferVoiceNames: vi.fn(),
    onNextKit: vi.fn(),
    onPlaySample: vi.fn(),
    onPrevKit: vi.fn(),
    onSampleKeyNav: vi.fn(),
    onScanKit: vi.fn(),
    samples: { 1: ["kick.wav", "snare.wav"] },
    selectedSampleIdx: 0,
    selectedVoice: 1,
    sequencerOpen: false,
    setSequencerOpen: vi.fn(),
    ...overrides,
  };

  const view = renderHook((p) => useKitEditorKeyboardNav(p), {
    initialProps: props,
  });

  const fire = (key: string) => {
    const e = { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    handlers.at(-1)?.(e);
    return e;
  };

  return { addSpy, fire, props, removeSpy, view };
}

describe("useKitEditorKeyboardNav", () => {
  beforeEach(() => {
    setActiveElement(document.body);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers and removes the keydown listener", () => {
    const { addSpy, removeSpy, view } = setup();
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    view.unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  describe("isTypingTarget guard", () => {
    it.each([
      ["INPUT (text)", () => document.createElement("input")],
      ["TEXTAREA", () => document.createElement("textarea")],
    ])("ignores shortcuts while focused in %s", (_label, make) => {
      const { fire, props } = setup();
      setActiveElement(make());
      const e = fire(",");
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(props.onPrevKit).not.toHaveBeenCalled();
    });

    it("still fires for a focused checkbox input", () => {
      const { fire, props } = setup();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      setActiveElement(checkbox);
      fire(",");
      expect(props.onPrevKit).toHaveBeenCalled();
    });

    it("ignores shortcuts while focused in a contenteditable element", () => {
      const { fire, props } = setup();
      const div = document.createElement("div");
      // jsdom doesn't derive isContentEditable from the attribute, so set the
      // property the hook actually reads.
      Object.defineProperty(div, "isContentEditable", {
        configurable: true,
        value: true,
      });
      setActiveElement(div);
      fire(".");
      expect(props.onNextKit).not.toHaveBeenCalled();
    });
  });

  describe("kit navigation", () => {
    it("comma triggers onPrevKit", () => {
      const { fire, props } = setup();
      const e = fire(",");
      expect(props.onPrevKit).toHaveBeenCalledTimes(1);
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it("period triggers onNextKit", () => {
      const { fire, props } = setup();
      fire(".");
      expect(props.onNextKit).toHaveBeenCalledTimes(1);
    });
  });

  describe("scan shortcut (/)", () => {
    it("infers voice names when editable", () => {
      const { fire, props } = setup({ isEditable: true });
      fire("/");
      expect(props.onInferVoiceNames).toHaveBeenCalledTimes(1);
      expect(props.onScanKit).not.toHaveBeenCalled();
    });

    it("scans the kit when not editable", () => {
      const { fire, props } = setup({ isEditable: false });
      fire("/");
      expect(props.onScanKit).toHaveBeenCalledTimes(1);
      expect(props.onInferVoiceNames).not.toHaveBeenCalled();
    });
  });

  describe("sequencer toggle (s)", () => {
    it.each(["s", "S"])("'%s' toggles the sequencer", (key) => {
      const { fire, props } = setup();
      fire(key);
      expect(props.setSequencerOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("sample navigation", () => {
    it("ArrowDown / ArrowUp navigate samples", () => {
      const { fire, props } = setup();
      fire("ArrowDown");
      fire("ArrowUp");
      expect(props.onSampleKeyNav).toHaveBeenNthCalledWith(1, "down");
      expect(props.onSampleKeyNav).toHaveBeenNthCalledWith(2, "up");
    });

    it("Space plays the selected sample when one exists", () => {
      const { fire, props } = setup();
      fire(" ");
      expect(props.onPlaySample).toHaveBeenCalledWith(1, "kick.wav");
    });

    it("Space is a no-op when the slot is empty", () => {
      const { fire, props } = setup({ samples: { 1: [] } });
      fire(" ");
      expect(props.onPlaySample).not.toHaveBeenCalled();
    });

    it("ignores sample-nav keys while the sequencer is open", () => {
      const { fire, props } = setup({ sequencerOpen: true });
      fire("ArrowDown");
      expect(props.onSampleKeyNav).not.toHaveBeenCalled();
    });
  });
});

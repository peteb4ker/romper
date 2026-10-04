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

  const fire = (key: string, modifiers: Partial<KeyboardEvent> = {}) => {
    const e = {
      key,
      preventDefault: vi.fn(),
      ...modifiers,
    } as unknown as KeyboardEvent;
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

  // #500: keys pressed in a dialog are the dialog's
  it("[UC-07] ignores its keys while a modal dialog is open", () => {
    const onToggleFavorite = vi.fn();
    const { fire, props } = setup({ onToggleFavorite });
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    for (const key of [",", ".", "/", "s", "f", "ArrowDown", " "]) fire(key);

    expect(onToggleFavorite).not.toHaveBeenCalled();
    expect(props.onPrevKit).not.toHaveBeenCalled();
    expect(props.onNextKit).not.toHaveBeenCalled();
    expect(props.onScanKit).not.toHaveBeenCalled();
    expect(props.setSequencerOpen).not.toHaveBeenCalled();
    expect(props.onSampleKeyNav).not.toHaveBeenCalled();
    expect(props.onPlaySample).not.toHaveBeenCalled();
    modal.remove();
  });

  describe("[UC-18] kit navigation", () => {
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

  // RE-38: Cmd+, opens Preferences and also stepped to the previous kit
  describe("[UC-18] Cmd, Ctrl and Alt combinations", () => {
    it.each([
      [",", { metaKey: true }],
      [".", { ctrlKey: true }],
      ["/", { metaKey: true }],
      ["s", { ctrlKey: true }],
      ["ArrowDown", { altKey: true }],
    ])("ignore %s with %o", (key, modifiers) => {
      const { fire, props } = setup();
      const e = fire(key, modifiers);
      expect(props.onPrevKit).not.toHaveBeenCalled();
      expect(props.onNextKit).not.toHaveBeenCalled();
      expect(props.onScanKit).not.toHaveBeenCalled();
      expect(props.setSequencerOpen).not.toHaveBeenCalled();
      expect(props.onSampleKeyNav).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });

    it("still allows Shift", () => {
      const { fire, props } = setup();
      fire("S", { shiftKey: true });
      expect(props.setSequencerOpen).toHaveBeenCalled();
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

  // #504: F stars or unstars the open kit
  describe("[UC-10] star shortcut (f)", () => {
    it.each([
      ["f", {}],
      ["F", { shiftKey: true }],
    ])("'%s' toggles the open kit's star", (key, modifiers) => {
      const onToggleFavorite = vi.fn();
      const { fire, props } = setup({ onToggleFavorite });
      const e = fire(key, modifiers);
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(props.setSequencerOpen).not.toHaveBeenCalled();
    });

    it.each(["metaKey", "ctrlKey", "altKey"])(
      "ignores f with %s held",
      (modifier) => {
        const onToggleFavorite = vi.fn();
        const { fire } = setup({ onToggleFavorite });
        fire("f", { [modifier]: true });
        expect(onToggleFavorite).not.toHaveBeenCalled();
      },
    );

    it("ignores f typed in a text field", () => {
      const onToggleFavorite = vi.fn();
      const { fire } = setup({ onToggleFavorite });
      setActiveElement(document.createElement("input"));
      fire("f");
      expect(onToggleFavorite).not.toHaveBeenCalled();
    });

    it("does nothing without a toggle", () => {
      const { fire } = setup();
      const e = fire("f");
      expect(e.preventDefault).not.toHaveBeenCalled();
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
      expect(props.onPlaySample).toHaveBeenCalledWith(1, 0);
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

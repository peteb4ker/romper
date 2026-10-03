import type { Kit, KitWithRelations } from "@romper/shared/db/schema.js";

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@romper/shared/kitUtilsShared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@romper/shared/kitUtilsShared")>()),
  isValidKit: vi.fn(() => true),
}));

import { isValidKit } from "@romper/shared/kitUtilsShared";

import { buildGridRows } from "../../utils/kitGridRows";
import {
  getArrowTarget,
  groupKitsByRow,
  useKitGridKeyboard,
} from "../useKitGridKeyboard";

const mockIsValidKit = vi.mocked(isValidKit);

function createMockKit(name: string): Kit {
  return {
    alias: null,
    artist: null,
    bank_letter: name[0],
    bpm: 120,
    editable: false,
    is_favorite: false,
    locked: false,
    modified_since_sync: false,
    name,
    step_pattern: null,
  };
}

// Three columns, grouped by bank:
//   A: A0 A1 A2
//      A3
//   B: B0
//   C: C0 C1
const kitsToDisplay: Kit[] = ["A0", "A1", "A2", "A3", "B0", "C0", "C1"].map(
  createMockKit,
);
const { rowIndexByKitIndex } = buildGridRows(
  kitsToDisplay as KitWithRelations[],
  { columnCount: 3, showAddCards: false },
);
const idx = (name: string) => kitsToDisplay.findIndex((k) => k.name === name);

const keyEvent = (
  key: string,
  target: Element = document.createElement("div"),
) =>
  ({
    key,
    preventDefault: vi.fn(),
    target,
  }) as unknown as React.KeyboardEvent;

describe("[UC-07] useKitGridKeyboard", () => {
  const mockOnSelectKit = vi.fn();
  const mockSetFocus = vi.fn();
  const mockOnBankFocus = vi.fn();
  const mockOnFocusKit = vi.fn();
  const mockScrollItemIntoView = vi.fn();
  const card = document.createElement("div");
  card.tabIndex = -1;

  const containerRef = {
    current: {
      querySelector: vi.fn(() => card),
    } as unknown as HTMLDivElement,
  };

  const props = (focusedIdx: null | number = 0) => ({
    containerRef,
    focusedIdx,
    kitsToDisplay,
    onBankFocus: mockOnBankFocus,
    onFocusKit: mockOnFocusKit,
    onSelectKit: mockOnSelectKit,
    rowIndexByKitIndex,
    scrollItemIntoView: mockScrollItemIntoView,
    setFocus: mockSetFocus,
  });

  const press = (key: string, focusedIdx: null | number = 0) => {
    const { result } = renderHook(() => useKitGridKeyboard(props(focusedIdx)));
    const event = keyEvent(key);
    result.current.handleKeyDown(event);
    return event;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidKit.mockReturnValue(true);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("groupKitsByRow", () => {
    it("groups kit indices into the rows drawn, per bank", () => {
      expect(groupKitsByRow(rowIndexByKitIndex)).toEqual([
        [0, 1, 2],
        [3],
        [4],
        [5, 6],
      ]);
    });

    it("handles no kits", () => {
      expect(groupKitsByRow([])).toEqual([]);
    });
  });

  describe("getArrowTarget", () => {
    const kitRows = groupKitsByRow(rowIndexByKitIndex);
    const target = (key: string, from: string) => {
      const to = getArrowTarget(key, idx(from), kitRows, kitsToDisplay.length);
      return to === null ? null : kitsToDisplay[to].name;
    };

    it("steps through the kits in order with Left and Right", () => {
      expect(target("ArrowRight", "A0")).toBe("A1");
      expect(target("ArrowRight", "A2")).toBe("A3");
      expect(target("ArrowLeft", "B0")).toBe("A3");
      expect(target("ArrowLeft", "A0")).toBeNull();
      expect(target("ArrowRight", "C1")).toBeNull();
    });

    it("moves to the same column of the row below, across bank headers", () => {
      expect(target("ArrowDown", "A0")).toBe("A3");
      expect(target("ArrowDown", "A3")).toBe("B0");
      expect(target("ArrowDown", "B0")).toBe("C0");
      expect(target("ArrowDown", "C1")).toBeNull();
    });

    it("lands on the last kit of a shorter row", () => {
      expect(target("ArrowDown", "A2")).toBe("A3");
      expect(target("ArrowUp", "C1")).toBe("B0");
    });

    it("moves to the same column of the row above", () => {
      expect(target("ArrowUp", "C0")).toBe("B0");
      expect(target("ArrowUp", "A3")).toBe("A0");
      expect(target("ArrowUp", "A1")).toBeNull();
    });
  });

  // RE-39: index 0 was treated as "nothing focused", so the keys did
  // nothing from the first kit, which is where focus starts
  describe("from the first kit", () => {
    it("Right moves to the second kit", () => {
      const event = press("ArrowRight", 0);

      expect(mockSetFocus).toHaveBeenCalledWith(1);
      expect(mockOnFocusKit).toHaveBeenCalledWith("A1");
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("Down moves to the row below", () => {
      press("ArrowDown", 0);

      expect(mockSetFocus).toHaveBeenCalledWith(idx("A3"));
    });

    it("Enter opens it", () => {
      press("Enter", 0);

      expect(mockOnSelectKit).toHaveBeenCalledWith("A0");
    });

    it("Space opens it", () => {
      press(" ", 0);

      expect(mockOnSelectKit).toHaveBeenCalledWith("A0");
    });
  });

  describe("with nothing focused", () => {
    it("an arrow focuses the first kit", () => {
      press("ArrowDown", null);

      expect(mockSetFocus).toHaveBeenCalledWith(0);
    });

    it("Enter opens nothing", () => {
      const event = press("Enter", null);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe("arrow navigation", () => {
    it("scrolls the kit into view and gives its card keyboard focus", () => {
      const focus = vi.spyOn(card, "focus");

      press("ArrowDown", idx("A3"));

      expect(mockScrollItemIntoView).toHaveBeenCalledWith(idx("B0"));
      expect(containerRef.current.querySelector).toHaveBeenCalledWith(
        '[data-kit="B0"]',
      );
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    it("stays put at the edge of the grid", () => {
      const event = press("ArrowUp", idx("A1"));

      expect(mockSetFocus).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("does nothing with no kits", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({
          ...props(null),
          kitsToDisplay: [],
          rowIndexByKitIndex: [],
        }),
      );
      result.current.handleKeyDown(keyEvent("ArrowDown"));

      expect(mockSetFocus).not.toHaveBeenCalled();
    });
  });

  describe("Enter", () => {
    it("opens the focused kit", () => {
      press("Enter", idx("B0"));

      expect(mockOnSelectKit).toHaveBeenCalledWith("B0");
    });

    it("doesn't open an invalid kit", () => {
      mockIsValidKit.mockReturnValue(false);

      press("Enter", 1);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
    });

    it("leaves Enter on a card's button to the button", () => {
      const { result } = renderHook(() => useKitGridKeyboard(props(0)));
      const event = keyEvent("Enter", document.createElement("button"));

      result.current.handleKeyDown(event);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("A-Z bank navigation", () => {
    it("focuses the first kit in the bank", () => {
      const event = press("b");

      expect(mockSetFocus).toHaveBeenCalledWith(idx("B0"));
      expect(mockOnBankFocus).toHaveBeenCalledWith("B");
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("handles an uppercase letter", () => {
      press("C");

      expect(mockSetFocus).toHaveBeenCalledWith(idx("C0"));
      expect(mockOnBankFocus).toHaveBeenCalledWith("C");
    });

    it("does nothing for a bank with no kits", () => {
      press("z");

      expect(mockSetFocus).not.toHaveBeenCalled();
      expect(mockOnBankFocus).not.toHaveBeenCalled();
    });
  });

  describe("text fields", () => {
    it.each(["input", "textarea"])("ignores keys typed in an %s", (tag) => {
      const { result } = renderHook(() => useKitGridKeyboard(props(1)));
      const event = keyEvent("Enter", document.createElement(tag));

      result.current.handleKeyDown(event);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("doesn't take focus from a field being typed in", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      const focus = vi.spyOn(card, "focus");
      const { result } = renderHook(() => useKitGridKeyboard(props(0)));

      result.current.scrollToKit("B0");

      expect(mockSetFocus).toHaveBeenCalledWith(idx("B0"));
      expect(focus).not.toHaveBeenCalled();
      input.remove();
    });
  });

  describe("scrollToKit", () => {
    it("scrolls to a kit by name", () => {
      const { result } = renderHook(() => useKitGridKeyboard(props()));

      result.current.scrollToKit("B0");

      expect(mockSetFocus).toHaveBeenCalledWith(idx("B0"));
    });

    it("does nothing for an unknown kit", () => {
      const { result } = renderHook(() => useKitGridKeyboard(props()));

      result.current.scrollToKit("Z9");

      expect(mockSetFocus).not.toHaveBeenCalled();
    });
  });

  describe("scrollAndFocusKitByIndex", () => {
    it("sets focus and calls onFocusKit", () => {
      const { result } = renderHook(() => useKitGridKeyboard(props()));

      result.current.scrollAndFocusKitByIndex(2);

      expect(mockSetFocus).toHaveBeenCalledWith(2);
      expect(mockOnFocusKit).toHaveBeenCalledWith("A2");
    });

    it.each([99, -1])("does nothing for index %i", (index) => {
      const { result } = renderHook(() => useKitGridKeyboard(props()));

      result.current.scrollAndFocusKitByIndex(index);

      expect(mockSetFocus).not.toHaveBeenCalled();
    });

    it("scrolls the DOM element without a virtualized list", () => {
      const scrollIntoView = vi.fn();
      const element = document.createElement("div");
      element.scrollIntoView = scrollIntoView;
      const domRef = {
        current: {
          querySelector: vi.fn(() => element),
        } as unknown as HTMLDivElement,
      };
      const { result } = renderHook(() =>
        useKitGridKeyboard({
          ...props(),
          containerRef: domRef,
          scrollItemIntoView: undefined,
        }),
      );

      result.current.scrollAndFocusKitByIndex(1);

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
    });
  });
});

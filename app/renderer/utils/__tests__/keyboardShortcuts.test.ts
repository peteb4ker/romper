import { describe, expect, it } from "vitest";

import { isContextMenuKey, sampleMoveDirection } from "../keyboardShortcuts";

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  altKey: false,
  ctrlKey: false,
  key,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("[Q-06] [UC-21] sampleMoveDirection (#522)", () => {
  it("maps Alt (Option on macOS) with each arrow to its direction", () => {
    expect(sampleMoveDirection(press("ArrowUp", { altKey: true }))).toBe("up");
    expect(sampleMoveDirection(press("ArrowDown", { altKey: true }))).toBe(
      "down",
    );
    expect(sampleMoveDirection(press("ArrowLeft", { altKey: true }))).toBe(
      "left",
    );
    expect(sampleMoveDirection(press("ArrowRight", { altKey: true }))).toBe(
      "right",
    );
  });

  it("leaves plain arrows to sample navigation", () => {
    expect(sampleMoveDirection(press("ArrowUp"))).toBeNull();
  });

  it("ignores Alt with another modifier, or with a key that isn't an arrow", () => {
    for (const modifier of ["metaKey", "ctrlKey", "shiftKey"]) {
      expect(
        sampleMoveDirection(
          press("ArrowUp", { altKey: true, [modifier]: true }),
        ),
      ).toBeNull();
    }
    expect(sampleMoveDirection(press("a", { altKey: true }))).toBeNull();
  });
});

describe("[Q-06] [UC-25] isContextMenuKey (#522)", () => {
  it("is the context-menu key or Shift+F10", () => {
    expect(isContextMenuKey(press("ContextMenu"))).toBe(true);
    expect(isContextMenuKey(press("F10", { shiftKey: true }))).toBe(true);
  });

  it("isn't F10 alone, or either key with Cmd, Ctrl or Alt", () => {
    expect(isContextMenuKey(press("F10"))).toBe(false);
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      expect(isContextMenuKey(press("ContextMenu", { [modifier]: true }))).toBe(
        false,
      );
      expect(
        isContextMenuKey(press("F10", { [modifier]: true, shiftKey: true })),
      ).toBe(false);
    }
  });
});

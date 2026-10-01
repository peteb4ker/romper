import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SequencerKeysButton, SequencerKeysOverlay } from "../SequencerHelp";

afterEach(() => cleanup());

describe("SequencerKeysButton", () => {
  it("opens the shortcut list", () => {
    const onClick = vi.fn();
    render(<SequencerKeysButton onClick={onClick} />);
    const button = screen.getByTestId("sequencer-keys-button");
    expect(button).toHaveAccessibleName("Keyboard shortcuts");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("SequencerKeysOverlay", () => {
  it("takes focus, and closes on ? or Escape", () => {
    const onClose = vi.fn();
    render(<SequencerKeysOverlay onClose={onClose} />);
    const overlay = screen.getByTestId("sequencer-keys-overlay");
    expect(document.activeElement).toBe(overlay);

    fireEvent.keyDown(overlay, { key: "?" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps other keys from reaching the grid behind it", () => {
    const behind = vi.fn();
    render(
      <div onKeyDown={behind}>
        <SequencerKeysOverlay onClose={vi.fn()} />
      </div>,
    );
    fireEvent.keyDown(screen.getByTestId("sequencer-keys-overlay"), {
      key: "Enter",
    });
    expect(behind).not.toHaveBeenCalled();
  });
});

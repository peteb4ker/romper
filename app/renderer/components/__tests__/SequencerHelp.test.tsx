import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SequencerKeysOverlay, SequencerStatusLine } from "../SequencerHelp";

afterEach(() => cleanup());

describe("SequencerStatusLine", () => {
  it("shows the general keys, and the slicer keys on a slice row", () => {
    const { rerender } = render(
      <SequencerStatusLine onShowKeys={vi.fn()} sliceRow={false} />,
    );
    const line = screen.getByTestId("sequencer-status-line");
    expect(line).toHaveTextContent("play / stop");
    expect(line).not.toHaveTextContent("roll");

    rerender(<SequencerStatusLine onShowKeys={vi.fn()} sliceRow={true} />);
    expect(line).toHaveTextContent("roll");
    expect(line).not.toHaveTextContent("play / stop");
  });

  it("opens the full list", () => {
    const onShowKeys = vi.fn();
    render(<SequencerStatusLine onShowKeys={onShowKeys} sliceRow={false} />);
    fireEvent.click(screen.getByTestId("sequencer-keys-button"));
    expect(onShowKeys).toHaveBeenCalled();
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

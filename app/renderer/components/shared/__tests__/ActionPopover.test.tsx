import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ActionPopover from "../ActionPopover";

const TestWrapper: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button data-testid="anchor" ref={anchorRef}>
        Trigger
      </button>
      <ActionPopover anchorRef={anchorRef} isOpen={isOpen} onClose={onClose}>
        <div data-testid="popover-content">Popover content</div>
      </ActionPopover>
    </>
  );
};

describe("ActionPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const onClose = vi.fn();
    render(<TestWrapper isOpen={false} onClose={onClose} />);
    expect(screen.queryByTestId("action-popover")).not.toBeInTheDocument();
  });

  it("renders children when open", () => {
    const onClose = vi.fn();
    render(<TestWrapper isOpen={true} onClose={onClose} />);
    expect(screen.getByTestId("action-popover")).toBeInTheDocument();
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    expect(screen.getByText("Popover content")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<TestWrapper isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses fixed positioning with z-50", () => {
    const onClose = vi.fn();
    render(<TestWrapper isOpen={true} onClose={onClose} />);
    const popover = screen.getByTestId("action-popover");
    expect(popover).toHaveClass("fixed", "z-50");
  });
});

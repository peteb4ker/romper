// Test suite for KitDialogs component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import KitDialogs from "../KitDialogs";

describe("KitDialogs", () => {
  const defaultProps = {
    duplicateKitDest: "",
    duplicateKitError: null,
    duplicateKitSource: null,
    onCancelDuplicateKit: vi.fn(),
    onDuplicateKit: vi.fn(),
    onDuplicateKitDestChange: vi.fn(),
    showDuplicateKit: false,
  };

  afterEach(() => {
    cleanup();
  });

  it("renders nothing if dialog is hidden", () => {
    render(<KitDialogs {...defaultProps} />);
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument();
  });

  it("renders duplicate kit dialog and handles input and buttons", () => {
    const onDuplicateKitDestChange = vi.fn();
    const onDuplicateKit = vi.fn();
    const onCancelDuplicateKit = vi.fn();
    render(
      <KitDialogs
        {...defaultProps}
        duplicateKitDest="B2"
        duplicateKitError="Duplicate error"
        duplicateKitSource="A1"
        onCancelDuplicateKit={onCancelDuplicateKit}
        onDuplicateKit={onDuplicateKit}
        onDuplicateKitDestChange={onDuplicateKitDestChange}
        showDuplicateKit={true}
      />,
    );
    expect(screen.getByLabelText("Duplicate A1 to:")).toHaveValue("B2");
    expect(screen.getByText("Duplicate error")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Duplicate A1 to:"), {
      target: { value: "c3" },
    });
    expect(onDuplicateKitDestChange).toHaveBeenCalledWith("C3");
    fireEvent.click(screen.getByText("Duplicate"));
    expect(onDuplicateKit).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancelDuplicateKit).toHaveBeenCalled();
  });
});

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
    newKitError: null,
    newKitSlot: "",
    onCancelDuplicateKit: vi.fn(),
    onCancelNewKit: vi.fn(),
    onCreateKit: vi.fn(),
    onDuplicateKit: vi.fn(),
    onDuplicateKitDestChange: vi.fn(),
    onNewKitSlotChange: vi.fn(),
    showDuplicateKit: false,
    showNewKit: false,
  };

  afterEach(() => {
    cleanup();
  });

  it("renders nothing if both dialogs are hidden", () => {
    render(<KitDialogs {...defaultProps} />);
    expect(screen.queryByText("Kit Slot (A0-Z99):")).not.toBeInTheDocument();
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument();
  });

  it("renders new kit dialog and handles input and buttons", () => {
    const onNewKitSlotChange = vi.fn();
    const onCreateKit = vi.fn();
    const onCancelNewKit = vi.fn();
    render(
      <KitDialogs
        {...defaultProps}
        newKitError="Slot error"
        newKitSlot="A1"
        onCancelNewKit={onCancelNewKit}
        onCreateKit={onCreateKit}
        onNewKitSlotChange={onNewKitSlotChange}
        showNewKit={true}
      />,
    );
    expect(screen.getByLabelText("Kit Slot (A0-Z99):")).toHaveValue("A1");
    expect(screen.getByText("Slot error")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kit Slot (A0-Z99):"), {
      target: { value: "b2" },
    });
    expect(onNewKitSlotChange).toHaveBeenCalledWith("B2");
    fireEvent.click(screen.getByText("Create"));
    expect(onCreateKit).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancelNewKit).toHaveBeenCalled();
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
    fireEvent.click(screen.getAllByText("Cancel")[0]);
    expect(onCancelDuplicateKit).toHaveBeenCalled();
  });
});

// Test suite for KitDialogs component
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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

  describe("[UC-15] [Q-06] focus", () => {
    it("focuses the destination field as it appears", () => {
      const { rerender } = render(<KitDialogs {...defaultProps} />);
      expect(document.body).toHaveFocus();

      rerender(
        <KitDialogs
          {...defaultProps}
          duplicateKitSource="A1"
          showDuplicateKit={true}
        />,
      );
      expect(screen.getByLabelText("Duplicate A1 to:")).toHaveFocus();
    });

    it("leaves focus alone while the field stays open", () => {
      const { rerender } = render(
        <KitDialogs
          {...defaultProps}
          duplicateKitSource="A1"
          showDuplicateKit={true}
        />,
      );
      const duplicate = screen.getByText("Duplicate");
      duplicate.focus();

      rerender(
        <KitDialogs
          {...defaultProps}
          duplicateKitDest="B2"
          duplicateKitSource="A1"
          showDuplicateKit={true}
        />,
      );
      expect(duplicate).toHaveFocus();
    });
  });
});

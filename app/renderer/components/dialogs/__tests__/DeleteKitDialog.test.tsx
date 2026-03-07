import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeleteKitDialog from "../DeleteKitDialog";

describe("DeleteKitDialog", () => {
  const defaultProps = {
    isDeleting: false,
    kitName: "A5",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    sampleCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders the dialog with kit name", () => {
      render(<DeleteKitDialog {...defaultProps} />);
      expect(screen.getByText(/Delete kit A5/)).toBeInTheDocument();
    });

    it("shows safe-to-remove message when no samples", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={0} />);
      expect(
        screen.getByText("This kit has no samples. Safe to remove."),
      ).toBeInTheDocument();
    });

    it("shows sample count warning when kit has samples", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={5} />);
      expect(screen.getByText(/5 sample/)).toBeInTheDocument();
      expect(
        screen.getByText(/Original files on disk are not affected/),
      ).toBeInTheDocument();
    });

    it("uses singular 'reference' for one sample", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={1} />);
      expect(screen.getByText(/1 sample/)).toBeInTheDocument();
      expect(screen.getByText(/reference will/)).toBeInTheDocument();
    });

    it("uses plural 'references' for multiple samples", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={3} />);
      expect(screen.getByText(/references will/)).toBeInTheDocument();
    });

    it("shows warning border when samples exist", () => {
      const { container } = render(
        <DeleteKitDialog {...defaultProps} sampleCount={5} />,
      );
      const wrapper = container.firstElementChild;
      expect(wrapper?.className).toContain("border-accent-warning");
    });

    it("shows subtle border when no samples", () => {
      const { container } = render(
        <DeleteKitDialog {...defaultProps} sampleCount={0} />,
      );
      const wrapper = container.firstElementChild;
      expect(wrapper?.className).toContain("border-border-subtle");
    });
  });

  describe("buttons", () => {
    it("renders Delete and Cancel buttons", () => {
      render(<DeleteKitDialog {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /Delete/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cancel/ }),
      ).toBeInTheDocument();
    });

    it("calls onConfirm when Delete is clicked", () => {
      render(<DeleteKitDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
      expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
    });

    it("calls onCancel when Cancel is clicked", () => {
      render(<DeleteKitDialog {...defaultProps} />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
      expect(defaultProps.onCancel).toHaveBeenCalledOnce();
    });

    it("disables buttons when isDeleting is true", () => {
      render(<DeleteKitDialog {...defaultProps} isDeleting={true} />);
      expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Cancel/ })).toBeDisabled();
    });

    it("shows 'Deleting...' text when isDeleting", () => {
      render(<DeleteKitDialog {...defaultProps} isDeleting={true} />);
      expect(screen.getByText("Deleting...")).toBeInTheDocument();
    });

    it("uses danger button style when samples exist", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={5} />);
      const deleteBtn = screen.getByRole("button", { name: /Delete/ });
      expect(deleteBtn.className).toContain("bg-accent-danger");
    });

    it("uses primary button style when no samples", () => {
      render(<DeleteKitDialog {...defaultProps} sampleCount={0} />);
      const deleteBtn = screen.getByRole("button", { name: /Delete/ });
      expect(deleteBtn.className).toContain("bg-accent-primary");
    });
  });
});

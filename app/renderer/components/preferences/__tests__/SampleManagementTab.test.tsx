import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SampleManagementTab from "../SampleManagementTab";

describe("SampleManagementTab", () => {
  const defaultProps = {
    confirmDestructiveActions: false,
    onConfirmDestructiveActionsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Component rendering", () => {
    it("renders the section heading", () => {
      render(<SampleManagementTab {...defaultProps} />);

      expect(screen.getByText("Sample Assignment")).toBeInTheDocument();
    });

    it("renders the confirm destructive actions option", () => {
      render(<SampleManagementTab {...defaultProps} />);

      expect(
        screen.getByText("Confirm destructive actions"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Show confirmation prompts before replacing or deleting samples",
        ),
      ).toBeInTheDocument();
    });

    it("renders the checkbox", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const destructiveCheckbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });

      expect(destructiveCheckbox).toBeInTheDocument();
    });
  });

  describe("Checkbox states", () => {
    it("renders destructive checkbox as unchecked when confirmDestructiveActions is false", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });
      expect(checkbox).not.toBeChecked();
    });

    it("renders destructive checkbox as checked when confirmDestructiveActions is true", () => {
      render(
        <SampleManagementTab
          {...defaultProps}
          confirmDestructiveActions={true}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });
      expect(checkbox).toBeChecked();
    });
  });

  describe("Checkbox interactions", () => {
    it("calls onConfirmDestructiveActionsChange when destructive checkbox is toggled on", () => {
      const mockOnChange = vi.fn();

      render(
        <SampleManagementTab
          {...defaultProps}
          onConfirmDestructiveActionsChange={mockOnChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it("calls onConfirmDestructiveActionsChange with false when destructive checkbox is toggled off", () => {
      const mockOnChange = vi.fn();

      render(
        <SampleManagementTab
          {...defaultProps}
          confirmDestructiveActions={true}
          onConfirmDestructiveActionsChange={mockOnChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Accessibility", () => {
    it("associates labels with checkboxes via htmlFor", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const destructiveCheckbox = document.getElementById(
        "confirm-destructive-checkbox",
      );

      expect(destructiveCheckbox).toBeInTheDocument();
      expect(destructiveCheckbox).toHaveAttribute("type", "checkbox");
    });
  });

  describe("Component styling", () => {
    it("applies correct root container styling", () => {
      const { container } = render(<SampleManagementTab {...defaultProps} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass("space-y-6");
    });

    it("applies correct checkbox styling", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const destructiveCheckbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });
      expect(destructiveCheckbox).toHaveClass(
        "rounded",
        "border-border-default",
        "text-accent-primary",
        "focus:ring-accent-primary",
      );
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SampleManagementTab from "../SampleManagementTab";

describe("SampleManagementTab", () => {
  const defaultProps = {
    confirmDestructiveActions: false,
    defaultToMonoSamples: false,
    onConfirmDestructiveActionsChange: vi.fn(),
    onDefaultToMonoSamplesChange: vi.fn(),
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

    it("renders the default to mono samples option", () => {
      render(<SampleManagementTab {...defaultProps} />);

      expect(screen.getByText("Default to mono samples")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Automatically assign stereo samples as mono to a single voice.",
        ),
      ).toBeInTheDocument();
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

    it("renders both checkboxes", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const monoCheckbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      const destructiveCheckbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });

      expect(monoCheckbox).toBeInTheDocument();
      expect(destructiveCheckbox).toBeInTheDocument();
    });

    it("renders stereo mode description paragraphs", () => {
      render(<SampleManagementTab {...defaultProps} />);

      expect(
        screen.getByText(/When enabled, stereo samples will take 1 mono slot/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /When disabled, stereo samples will be assigned to adjacent/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Checkbox states", () => {
    it("renders mono checkbox as unchecked when defaultToMonoSamples is false", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const checkbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      expect(checkbox).not.toBeChecked();
    });

    it("renders mono checkbox as checked when defaultToMonoSamples is true", () => {
      render(
        <SampleManagementTab {...defaultProps} defaultToMonoSamples={true} />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      expect(checkbox).toBeChecked();
    });

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

    it("renders both checkboxes as checked when both props are true", () => {
      render(
        <SampleManagementTab
          {...defaultProps}
          confirmDestructiveActions={true}
          defaultToMonoSamples={true}
        />,
      );

      const monoCheckbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      const destructiveCheckbox = screen.getByRole("checkbox", {
        name: "Confirm destructive actions",
      });

      expect(monoCheckbox).toBeChecked();
      expect(destructiveCheckbox).toBeChecked();
    });
  });

  describe("Checkbox interactions", () => {
    it("calls onDefaultToMonoSamplesChange when mono checkbox is toggled on", () => {
      const mockOnChange = vi.fn();

      render(
        <SampleManagementTab
          {...defaultProps}
          onDefaultToMonoSamplesChange={mockOnChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it("calls onDefaultToMonoSamplesChange with false when mono checkbox is toggled off", () => {
      const mockOnChange = vi.fn();

      render(
        <SampleManagementTab
          {...defaultProps}
          defaultToMonoSamples={true}
          onDefaultToMonoSamplesChange={mockOnChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });

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

    it("does not trigger the other callback when one checkbox is clicked", () => {
      const mockMonoChange = vi.fn();
      const mockDestructiveChange = vi.fn();

      render(
        <SampleManagementTab
          {...defaultProps}
          onConfirmDestructiveActionsChange={mockDestructiveChange}
          onDefaultToMonoSamplesChange={mockMonoChange}
        />,
      );

      const monoCheckbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      fireEvent.click(monoCheckbox);

      expect(mockMonoChange).toHaveBeenCalledOnce();
      expect(mockDestructiveChange).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("associates labels with checkboxes via htmlFor", () => {
      render(<SampleManagementTab {...defaultProps} />);

      const monoCheckbox = document.getElementById("default-mono-checkbox");
      const destructiveCheckbox = document.getElementById(
        "confirm-destructive-checkbox",
      );

      expect(monoCheckbox).toBeInTheDocument();
      expect(monoCheckbox).toHaveAttribute("type", "checkbox");
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

      const monoCheckbox = screen.getByRole("checkbox", {
        name: "Default to mono samples",
      });
      expect(monoCheckbox).toHaveClass(
        "rounded",
        "border-border-default",
        "text-accent-primary",
        "focus:ring-accent-primary",
      );
    });
  });
});

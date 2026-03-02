import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CriticalErrorDialog from "../CriticalErrorDialog";

// Mock @phosphor-icons/react
vi.mock("@phosphor-icons/react", () => ({
  Warning: vi.fn(() => <div data-testid="alert-triangle">Alert</div>),
}));

describe("CriticalErrorDialog", () => {
  const defaultProps = {
    isOpen: true,
    message:
      "The environment variable ROMPER_LOCAL_PATH is set to an invalid path.",
    onConfirm: vi.fn(),
    title: "Critical Configuration Error",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should not render when closed", () => {
    render(<CriticalErrorDialog {...defaultProps} isOpen={false} />);
    expect(
      screen.queryByText("Critical Configuration Error"),
    ).not.toBeInTheDocument();
  });

  it("should render title and message when open", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    expect(
      screen.getByText("Critical Configuration Error"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The environment variable ROMPER_LOCAL_PATH is set to an invalid path.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("alert-triangle")).toBeInTheDocument();
  });

  it("should call onConfirm when OK button is clicked", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    const okButton = screen.getByText("OK - Exit Application");
    fireEvent.click(okButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("should render the OK button", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    const okButton = screen.getByText("OK - Exit Application");
    expect(okButton).toBeInTheDocument();
    expect(okButton).toBeEnabled();
  });

  it("should have proper styling classes", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    // Check for critical error styling on the dialog container
    const dialogContainer = screen
      .getByText("Critical Configuration Error")
      .closest(".rounded-lg");
    expect(dialogContainer).toHaveClass("border-2", "border-accent-danger");

    const okButton = screen.getByText("OK - Exit Application");
    expect(okButton).toHaveClass(
      "bg-accent-danger",
      "hover:bg-accent-danger/80",
    );
  });

  it("should render with custom title and message", () => {
    const customProps = {
      ...defaultProps,
      message: "This is a custom error message for testing purposes.",
      title: "Custom Error Title",
    };

    render(<CriticalErrorDialog {...customProps} />);

    expect(screen.getByText("Custom Error Title")).toBeInTheDocument();
    expect(
      screen.getByText("This is a custom error message for testing purposes."),
    ).toBeInTheDocument();
  });

  it("should have proper accessibility attributes", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    const okButton = screen.getByText("OK - Exit Application");
    expect(okButton).toHaveClass(
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-accent-danger",
    );
  });

  it("should have higher z-index than other modals", () => {
    render(<CriticalErrorDialog {...defaultProps} />);

    const backdrop = screen
      .getByText("Critical Configuration Error")
      .closest(".fixed");
    expect(backdrop).toHaveClass("z-50");
    expect(backdrop).toHaveClass("bg-black/90"); // More opaque than regular modals
  });
});

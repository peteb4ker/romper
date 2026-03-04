import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AddKitCard from "../AddKitCard";

afterEach(() => {
  cleanup();
});

describe("AddKitCard", () => {
  const defaultProps = {
    bankLetter: "A",
    isCreating: false,
    onClick: vi.fn(),
  };

  it("renders with correct test id and aria label", () => {
    render(<AddKitCard {...defaultProps} />);
    const button = screen.getByTestId("add-kit-A");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Add kit to bank A");
  });

  it("displays 'Add Kit' text", () => {
    render(<AddKitCard {...defaultProps} />);
    expect(screen.getByText("Add Kit")).toBeInTheDocument();
  });

  it("calls onClick with bank letter when clicked", () => {
    const onClick = vi.fn();
    render(<AddKitCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByTestId("add-kit-A"));
    expect(onClick).toHaveBeenCalledWith("A");
  });

  it("shows 'Creating...' when isCreating is true", () => {
    render(<AddKitCard {...defaultProps} isCreating={true} />);
    expect(screen.getByText("Creating...")).toBeInTheDocument();
    expect(screen.queryByText("Add Kit")).not.toBeInTheDocument();
  });

  it("is disabled when isCreating is true", () => {
    render(<AddKitCard {...defaultProps} isCreating={true} />);
    expect(screen.getByTestId("add-kit-A")).toBeDisabled();
  });

  it("is not disabled when isCreating is false", () => {
    render(<AddKitCard {...defaultProps} />);
    expect(screen.getByTestId("add-kit-A")).not.toBeDisabled();
  });

  it("renders for different bank letters", () => {
    render(<AddKitCard {...defaultProps} bankLetter="Z" />);
    const button = screen.getByTestId("add-kit-Z");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Add kit to bank Z");
  });
});

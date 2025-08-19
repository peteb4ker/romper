import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UnscannedKitPrompt from "../UnscannedKitPrompt";

describe("UnscannedKitPrompt", () => {
  const mockOnScan = vi.fn();
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with kit name", () => {
    render(
      <UnscannedKitPrompt
        kitName="A01"
        onDismiss={mockOnDismiss}
        onScan={mockOnScan}
      />
    );

    expect(screen.getByText(/Kit needs scanning/i)).toBeInTheDocument();
    expect(screen.getByText("A01")).toBeInTheDocument();
  });

  it("calls onScan when scan button is clicked", () => {
    render(
      <UnscannedKitPrompt
        kitName="A01"
        onDismiss={mockOnDismiss}
        onScan={mockOnScan}
      />
    );

    fireEvent.click(screen.getByTestId("unscanned-scan-button"));
    expect(mockOnScan).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(
      <UnscannedKitPrompt
        kitName="A01"
        onDismiss={mockOnDismiss}
        onScan={mockOnScan}
      />
    );

    fireEvent.click(screen.getAllByTestId("unscanned-dismiss-button")[0]);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});

// Test suite for KitBrowserHeader component
import { cleanup, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../../../tests/utils/renderWithProviders";
import KitBrowserHeader from "../KitBrowserHeader";

afterEach(() => {
  cleanup();
});

describe("KitBrowserHeader", () => {
  const defaultProps = {
    nextKitSlot: null,
    onCreateNextKit: vi.fn(),
    onShowLocalStoreWizard: vi.fn(),
    onShowNewKit: vi.fn(),
    onShowSettings: vi.fn(),
    onValidateLocalStore: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onShowNewKit when + New Kit button is clicked", () => {
    const onShowNewKit = vi.fn();
    render(<KitBrowserHeader {...defaultProps} onShowNewKit={onShowNewKit} />);
    fireEvent.click(screen.getByText("+ New Kit"));
    expect(onShowNewKit).toHaveBeenCalled();
  });

  // Scan All Kits button has been removed from UI (still available in menu)

  it("calls onValidateLocalStore when Validate Store button is clicked", () => {
    const onValidateLocalStore = vi.fn();
    render(
      <KitBrowserHeader
        {...defaultProps}
        onValidateLocalStore={onValidateLocalStore}
      />
    );
    fireEvent.click(screen.getByText("Validate Store"));
    expect(onValidateLocalStore).toHaveBeenCalled();
  });

  // No separate tests for scan options dropdown as it's been removed

  // Next Kit button has been removed from the interface

  it("calls onShowSettings when Settings button is clicked", () => {
    const onShowSettings = vi.fn();
    render(
      <KitBrowserHeader {...defaultProps} onShowSettings={onShowSettings} />
    );
    fireEvent.click(screen.getByText("Settings"));
    expect(onShowSettings).toHaveBeenCalled();
  });

  it("renders bankNav if provided", () => {
    render(
      <KitBrowserHeader
        {...defaultProps}
        bankNav={<div data-testid="bank-nav">BANKS</div>}
      />
    );
    expect(screen.getByTestId("bank-nav")).toBeInTheDocument();
  });
});

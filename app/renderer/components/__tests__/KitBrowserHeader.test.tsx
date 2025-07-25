// Test suite for KitBrowserHeader component
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

import KitBrowserHeader from "../KitBrowserHeader";

afterEach(() => {
  cleanup();
});

describe("KitBrowserHeader", () => {
  const defaultProps = {
    onRescanAllVoiceNames: vi.fn(),
    onScanAllKits: vi.fn(),
    onShowNewKit: vi.fn(),
    onCreateNextKit: vi.fn(),
    nextKitSlot: null,
    onShowLocalStoreWizard: vi.fn(),
    onValidateLocalStore: vi.fn(),
  };

  it("calls onRescanAllVoiceNames when Rescan All Kit Voice Names button is clicked", () => {
    const onRescanAllVoiceNames = vi.fn();
    render(
      <KitBrowserHeader
        {...defaultProps}
        onRescanAllVoiceNames={onRescanAllVoiceNames}
      />,
    );
    fireEvent.click(screen.getByText("Rescan All Kit Voice Names"));
    expect(onRescanAllVoiceNames).toHaveBeenCalled();
  });

  it("calls onShowNewKit when + New Kit button is clicked", () => {
    const onShowNewKit = vi.fn();
    render(<KitBrowserHeader {...defaultProps} onShowNewKit={onShowNewKit} />);
    fireEvent.click(screen.getByText("+ New Kit"));
    expect(onShowNewKit).toHaveBeenCalled();
  });

  it("calls onScanAllKits when Scan All Kits button is clicked", () => {
    const onScanAllKits = vi.fn();
    render(
      <KitBrowserHeader {...defaultProps} onScanAllKits={onScanAllKits} />,
    );
    fireEvent.click(screen.getByText("Scan All Kits"));
    expect(onScanAllKits).toHaveBeenCalled();
  });

  it("calls onValidateLocalStore when Validate Local Store button is clicked", () => {
    const onValidateLocalStore = vi.fn();
    render(
      <KitBrowserHeader
        {...defaultProps}
        onValidateLocalStore={onValidateLocalStore}
      />,
    );
    fireEvent.click(screen.getByText("Validate Local Store"));
    expect(onValidateLocalStore).toHaveBeenCalled();
  });

  // No separate tests for scan options dropdown as it's been removed

  it("calls onCreateNextKit when + Next Kit button is clicked and nextKitSlot is set", () => {
    const onCreateNextKit = vi.fn();
    render(
      <KitBrowserHeader
        {...defaultProps}
        onCreateNextKit={onCreateNextKit}
        nextKitSlot={"A1"}
      />,
    );
    fireEvent.click(screen.getByText("+ Next Kit"));
    expect(onCreateNextKit).toHaveBeenCalled();
  });

  it("disables + Next Kit button when nextKitSlot is null", () => {
    render(<KitBrowserHeader {...defaultProps} nextKitSlot={null} />);
    expect(screen.getByText("+ Next Kit")).toBeDisabled();
  });

  it("renders bankNav if provided", () => {
    render(
      <KitBrowserHeader
        {...defaultProps}
        bankNav={<div data-testid="bank-nav">BANKS</div>}
      />,
    );
    expect(screen.getByTestId("bank-nav")).toBeInTheDocument();
  });
});

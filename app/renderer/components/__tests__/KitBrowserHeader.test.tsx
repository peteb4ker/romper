// Test suite for KitBrowserHeader component
import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

import KitBrowserHeader from "../KitBrowserHeader";

afterEach(() => {
  cleanup();
});

describe("KitBrowserHeader", () => {
  it("calls onRescanAllVoiceNames when Rescan All Kit Voice Names button is clicked", () => {
    const onRescanAllVoiceNames = vi.fn();
    render(
      <KitBrowserHeader
        onRescanAllVoiceNames={onRescanAllVoiceNames}
        onShowNewKit={vi.fn()}
        onCreateNextKit={vi.fn()}
        nextKitSlot={null}
      />,
    );
    fireEvent.click(screen.getByText("Rescan All Kit Voice Names"));
    expect(onRescanAllVoiceNames).toHaveBeenCalled();
  });

  it("calls onShowNewKit when + New Kit button is clicked", () => {
    const onShowNewKit = vi.fn();
    render(
      <KitBrowserHeader
        onRescanAllVoiceNames={vi.fn()}
        onShowNewKit={onShowNewKit}
        onCreateNextKit={vi.fn()}
        nextKitSlot={null}
      />,
    );
    fireEvent.click(screen.getByText("+ New Kit"));
    expect(onShowNewKit).toHaveBeenCalled();
  });

  it("calls onCreateNextKit when + Next Kit button is clicked and nextKitSlot is set", () => {
    const onCreateNextKit = vi.fn();
    render(
      <KitBrowserHeader
        onRescanAllVoiceNames={vi.fn()}
        onShowNewKit={vi.fn()}
        onCreateNextKit={onCreateNextKit}
        nextKitSlot={"A1"}
      />,
    );
    fireEvent.click(screen.getByText("+ Next Kit"));
    expect(onCreateNextKit).toHaveBeenCalled();
  });

  it("disables + Next Kit button when nextKitSlot is null", () => {
    render(
      <KitBrowserHeader
        onRescanAllVoiceNames={vi.fn()}
        onShowNewKit={vi.fn()}
        onCreateNextKit={vi.fn()}
        nextKitSlot={null}
      />,
    );
    expect(screen.getByText("+ Next Kit")).toBeDisabled();
  });

  it("renders bankNav if provided", () => {
    render(
      <KitBrowserHeader
        onRescanAllVoiceNames={vi.fn()}
        onShowNewKit={vi.fn()}
        onCreateNextKit={vi.fn()}
        nextKitSlot={null}
        bankNav={<div data-testid="bank-nav">BANKS</div>}
      />,
    );
    expect(screen.getByTestId("bank-nav")).toBeInTheDocument();
  });
});

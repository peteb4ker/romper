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
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onShowNewKit when New Kit button is clicked", () => {
    const onShowNewKit = vi.fn();
    render(<KitBrowserHeader {...defaultProps} onShowNewKit={onShowNewKit} />);
    fireEvent.click(screen.getByText("New Kit"));
    expect(onShowNewKit).toHaveBeenCalled();
  });

  it("calls onShowSettings when Settings button is clicked", () => {
    const onShowSettings = vi.fn();
    render(
      <KitBrowserHeader {...defaultProps} onShowSettings={onShowSettings} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onShowSettings).toHaveBeenCalled();
  });

  it("does not render bank nav in header", () => {
    render(<KitBrowserHeader {...defaultProps} />);
    expect(screen.queryByLabelText("Bank index")).not.toBeInTheDocument();
  });

  it("renders favorites toggle when handler provided", () => {
    render(
      <KitBrowserHeader
        {...defaultProps}
        favoritesCount={3}
        onToggleFavoritesFilter={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Show only favorite kits" }),
    ).toBeInTheDocument();
  });

  it("renders modified toggle when handler provided", () => {
    render(
      <KitBrowserHeader
        {...defaultProps}
        modifiedCount={2}
        onToggleModifiedFilter={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Show only modified kits" }),
    ).toBeInTheDocument();
  });
});

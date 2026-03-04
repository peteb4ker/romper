// Test suite for KitBrowserHeader component
import { cleanup, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock LedIconGrid to avoid RAF/animation complexity in tests
vi.mock("../led-icon/LedIconGrid", () => ({
  default: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="led-icon-grid" onClick={onClick}>
      LED Icon
    </button>
  ),
}));

import { render } from "../../../../tests/utils/renderWithProviders";
import KitBrowserHeader from "../KitBrowserHeader";

afterEach(() => {
  cleanup();
});

describe("KitBrowserHeader", () => {
  const defaultProps = {
    onShowLocalStoreWizard: vi.fn(),
    onShowSettings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render a New Kit button", () => {
    render(<KitBrowserHeader {...defaultProps} />);
    expect(screen.queryByText("New Kit")).not.toBeInTheDocument();
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

  it("renders LedIconGrid instead of static image", () => {
    render(<KitBrowserHeader {...defaultProps} />);
    expect(screen.getByTestId("led-icon-grid")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Romper" }),
    ).not.toBeInTheDocument();
  });

  it("calls onAboutClick when LED icon is clicked", () => {
    const onAboutClick = vi.fn();
    render(<KitBrowserHeader {...defaultProps} onAboutClick={onAboutClick} />);
    fireEvent.click(screen.getByTestId("led-icon-grid"));
    expect(onAboutClick).toHaveBeenCalled();
  });
});

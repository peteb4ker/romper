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

  describe("[UC-13] Scan All result", () => {
    it("shows a scan with no failures as a success", () => {
      render(
        <KitBrowserHeader
          {...defaultProps}
          bulkScanProgress={{
            failedCount: 0,
            message: "Scan completed: 2 successful, 0 failed.",
            status: "complete",
            successCount: 2,
          }}
        />,
      );
      const status = screen.getByTestId("bulk-scan-complete");
      expect(status).toHaveClass("text-accent-success");
      expect(status).not.toHaveClass("text-accent-warning");
    });

    it("shows a scan where some kits failed as a warning (#540)", () => {
      const message = "Scan completed: 1 successful, 1 failed.";
      render(
        <KitBrowserHeader
          {...defaultProps}
          bulkScanProgress={{
            failedCount: 1,
            message,
            status: "complete",
            successCount: 1,
          }}
        />,
      );
      const status = screen.getByTestId("bulk-scan-complete");
      expect(status).toHaveTextContent(message);
      expect(status).toHaveClass("text-accent-warning");
      expect(status).not.toHaveClass("text-accent-success");
    });

    // #586: a result with failed kits stays until the user dismisses it
    it("dismisses a scan where some kits failed with its ✕", () => {
      const onDismissBulkScan = vi.fn();
      render(
        <KitBrowserHeader
          {...defaultProps}
          bulkScanProgress={{
            failedCount: 1,
            message: "Scan completed: 1 successful, 1 failed.",
            status: "complete",
            successCount: 1,
          }}
          onDismissBulkScan={onDismissBulkScan}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
      expect(onDismissBulkScan).toHaveBeenCalledTimes(1);
    });

    it("has no ✕ on a scan with no failures, which clears itself", () => {
      render(
        <KitBrowserHeader
          {...defaultProps}
          bulkScanProgress={{
            failedCount: 0,
            message: "All 2 kits scanned successfully (comprehensive).",
            status: "complete",
            successCount: 2,
          }}
          onDismissBulkScan={vi.fn()}
        />,
      );
      expect(screen.getByTestId("bulk-scan-complete")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Dismiss message" }),
      ).not.toBeInTheDocument();
    });

    // #620: a scan that fails outright stays until dismissed, too
    it("shows a scan that failed outright as an error with a ✕", () => {
      const onDismissBulkScan = vi.fn();
      render(
        <KitBrowserHeader
          {...defaultProps}
          bulkScanProgress={{ message: "No kits to scan", status: "error" }}
          onDismissBulkScan={onDismissBulkScan}
        />,
      );
      const status = screen.getByTestId("bulk-scan-error");
      expect(status).toHaveTextContent("No kits to scan");
      expect(status).toHaveClass("text-accent-error");

      fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
      expect(onDismissBulkScan).toHaveBeenCalledTimes(1);
    });
  });
});

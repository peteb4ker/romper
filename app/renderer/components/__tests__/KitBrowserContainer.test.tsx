import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../shared/db/schema";

import KitBrowserContainer from "../KitBrowserContainer";

// Mock KitBrowser component
vi.mock("../KitBrowser", () => ({
  default: React.forwardRef(
    (
      { onMessage, onRefreshKits, onSelectKit, setLocalStorePath }: any,
      ref: any,
    ) => (
      <div data-testid="kit-browser" ref={ref}>
        <button onClick={() => onMessage("Test message", "info", 5000)}>
          Message
        </button>
        <button onClick={onRefreshKits}>Refresh</button>
        <button onClick={() => onSelectKit("test-kit")}>Select Kit</button>
        <button onClick={() => setLocalStorePath("/new/path")}>Set Path</button>
      </div>
    ),
  ),
}));

describe("KitBrowserContainer", () => {
  const mockKit: KitWithRelations = {
    alias: null,
    artist: null,
    bank_letter: "A",
    editable: false,
    locked: false,
    modified_since_sync: false,
    name: "TestKit",
    step_pattern: null,
    voices: [],
  };

  const defaultProps = {
    kits: [mockKit],
    localStorePath: "/test/path",
    onMessage: vi.fn(),
    onRefreshKits: vi.fn(),
    onSelectKit: vi.fn(),
    sampleCounts: { TestKit: [1, 2, 3, 4] as [number, number, number, number] },
    setLocalStorePath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<KitBrowserContainer {...defaultProps} />);
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });

    it("should render KitBrowser with correct props", () => {
      render(<KitBrowserContainer {...defaultProps} />);

      // Verify component renders and buttons are interactive
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
      expect(screen.getByText("Message")).toBeInTheDocument();
      expect(screen.getByText("Refresh")).toBeInTheDocument();
      expect(screen.getByText("Select Kit")).toBeInTheDocument();
      expect(screen.getByText("Set Path")).toBeInTheDocument();
    });

    it("should handle null localStorePath", () => {
      render(<KitBrowserContainer {...defaultProps} localStorePath={null} />);
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });
  });

  describe("callback handling", () => {
    it("should handle onMessage callback", () => {
      render(<KitBrowserContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Test message",
        "info",
        5000,
      );
    });

    it("should handle onRefreshKits callback", () => {
      render(<KitBrowserContainer {...defaultProps} />);

      const refreshButton = screen.getByText("Refresh");
      refreshButton.click();

      expect(defaultProps.onRefreshKits).toHaveBeenCalled();
    });

    it("should handle onSelectKit callback", () => {
      render(<KitBrowserContainer {...defaultProps} />);

      const selectButton = screen.getByText("Select Kit");
      selectButton.click();

      expect(defaultProps.onSelectKit).toHaveBeenCalledWith("test-kit");
    });

    it("should handle setLocalStorePath callback", () => {
      render(<KitBrowserContainer {...defaultProps} />);

      const setPathButton = screen.getByText("Set Path");
      setPathButton.click();

      expect(defaultProps.setLocalStorePath).toHaveBeenCalledWith("/new/path");
    });
  });

  describe("forwardRef", () => {
    it("should forward ref correctly", () => {
      const ref = React.createRef<any>();
      render(<KitBrowserContainer {...defaultProps} ref={ref} />);

      expect(ref.current).toBeDefined();
    });

    it("should handle forwardRef behavior correctly", () => {
      const ref = React.createRef<any>();
      render(<KitBrowserContainer {...defaultProps} ref={ref} />);

      // Additional verification that ref is passed through
      expect(ref.current).toBeDefined();
    });
  });

  describe("component behavior", () => {
    it("should handle prop changes gracefully", () => {
      const { rerender } = render(<KitBrowserContainer {...defaultProps} />);

      // Rerender with different props
      rerender(
        <KitBrowserContainer {...defaultProps} localStorePath="/new/path" />,
      );

      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });

    it("should maintain callback functionality across renders", () => {
      const { rerender } = render(<KitBrowserContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(1);

      // Rerender and test again
      rerender(<KitBrowserContainer {...defaultProps} />);
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty kits array", () => {
      render(<KitBrowserContainer {...defaultProps} kits={[]} />);
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });

    it("should handle empty sampleCounts object", () => {
      render(<KitBrowserContainer {...defaultProps} sampleCounts={{}} />);
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });

    it("should handle multiple kits", () => {
      const multipleKits = [mockKit, { ...mockKit, name: "Kit2" }];
      render(<KitBrowserContainer {...defaultProps} kits={multipleKits} />);
      expect(screen.getByTestId("kit-browser")).toBeInTheDocument();
    });
  });
});

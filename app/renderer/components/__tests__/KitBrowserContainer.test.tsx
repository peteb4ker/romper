import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type KitBrowser from "../KitBrowser";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import KitBrowserContainer from "../KitBrowserContainer";

type ContainerProps = React.ComponentProps<typeof KitBrowserContainer>;

// Mock KitBrowser component
vi.mock("../KitBrowser", () => ({
  default: (props: React.ComponentProps<typeof KitBrowser>) => (
    <div data-testid="kit-browser">
      <button onClick={() => props.onMessage?.("Test message", "info", 5000)}>
        Message
      </button>
      <button onClick={() => void props.onRefreshKits?.()}>Refresh</button>
      <button onClick={() => props.onSelectKit("test-kit")}>Select</button>
    </div>
  ),
}));

describe("KitBrowserContainer", () => {
  const mockKit = createMockKitWithRelations({ name: "TestKit" });

  const defaultProps = {
    kits: [mockKit],
    localStorePath: "/test/path",
    onMessage: vi.fn<ContainerProps["onMessage"]>(),
    onRefreshKits: vi
      .fn<ContainerProps["onRefreshKits"]>()
      .mockResolvedValue(undefined),
    onSelectKit: vi.fn<ContainerProps["onSelectKit"]>(),
    onShowSettings: vi.fn<ContainerProps["onShowSettings"]>(),
    sampleCounts: {
      TestKit: [1, 2, 3, 4],
    } satisfies ContainerProps["sampleCounts"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText("Select")).toBeInTheDocument();
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

      const selectButton = screen.getByText("Select");
      selectButton.click();

      expect(defaultProps.onSelectKit).toHaveBeenCalledWith("test-kit");
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

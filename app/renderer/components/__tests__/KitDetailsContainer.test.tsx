import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KitWithRelations } from "../../../../shared/db/schema";
import type { VoiceSamples } from "../kitTypes";

import KitDetailsContainer from "../KitDetailsContainer";

// Mock KitDetails component
vi.mock("../KitDetails", () => ({
  default: vi.fn(({ onBack, onMessage, onRequestSamplesReload }) => (
    <div data-testid="kit-details">
      <button onClick={() => onBack("test-kit")}>Back</button>
      <button onClick={() => onMessage("Test message", "info", 5000)}>
        Message
      </button>
      <button onClick={onRequestSamplesReload}>Reload Samples</button>
    </div>
  )),
}));

describe("KitDetailsContainer", () => {
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

  const mockSamples: VoiceSamples = {
    1: ["kick.wav"],
    2: ["snare.wav"],
  };

  const defaultProps = {
    kitIndex: 0,
    kitName: "TestKit",
    kits: [mockKit],
    onAddUndoAction: vi.fn(),
    onBack: vi.fn().mockResolvedValue(undefined),
    onMessage: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onRequestSamplesReload: vi.fn().mockResolvedValue(undefined),
    samples: mockSamples,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<KitDetailsContainer {...defaultProps} />);
      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
    });

    it("should render KitDetails with all buttons functional", () => {
      render(<KitDetailsContainer {...defaultProps} />);

      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
      expect(screen.getByText("Back")).toBeInTheDocument();
      expect(screen.getByText("Message")).toBeInTheDocument();
      expect(screen.getByText("Reload Samples")).toBeInTheDocument();
    });
  });

  describe("callback handling", () => {
    it("should handle onBack callback with parameters", async () => {
      render(<KitDetailsContainer {...defaultProps} />);

      const backButton = screen.getByText("Back");
      backButton.click();

      expect(defaultProps.onBack).toHaveBeenCalledWith("test-kit");
    });

    it("should handle onMessage callback", () => {
      render(<KitDetailsContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Test message",
        "info",
        5000,
      );
    });

    it("should handle onRequestSamplesReload callback", () => {
      render(<KitDetailsContainer {...defaultProps} />);

      const reloadButton = screen.getByText("Reload Samples");
      reloadButton.click();

      expect(defaultProps.onRequestSamplesReload).toHaveBeenCalled();
    });
  });

  describe("component behavior", () => {
    it("should handle prop changes gracefully", () => {
      const { rerender } = render(<KitDetailsContainer {...defaultProps} />);

      // Rerender with different props
      rerender(<KitDetailsContainer {...defaultProps} kitName="NewKit" />);

      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
    });

    it("should maintain callback functionality across renders", () => {
      const { rerender } = render(<KitDetailsContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(1);

      // Rerender and test again
      rerender(<KitDetailsContainer {...defaultProps} />);
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty kits array", () => {
      render(<KitDetailsContainer {...defaultProps} kits={[]} />);
      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
    });

    it("should handle empty samples object", () => {
      render(<KitDetailsContainer {...defaultProps} samples={{}} />);
      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
    });

    it("should handle null kit name", () => {
      render(<KitDetailsContainer {...defaultProps} kitName="" />);
      expect(screen.getByTestId("kit-details")).toBeInTheDocument();
    });
  });
});

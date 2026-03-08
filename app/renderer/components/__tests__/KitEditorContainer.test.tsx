import type { KitWithRelations } from "@romper/shared/db/schema";

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VoiceSamples } from "../kitTypes";

import KitEditorContainer from "../KitEditorContainer";

// Mock KitEditor component
vi.mock("../KitEditor", () => ({
  default: vi.fn(({ onBack, onMessage, onRequestSamplesReload }) => (
    <div data-testid="kit-editor">
      <button onClick={() => onBack("test-kit")}>Back</button>
      <button onClick={() => onMessage("Test message", "info", 5000)}>
        Message
      </button>
      <button onClick={onRequestSamplesReload}>Reload</button>
    </div>
  )),
}));

describe("KitEditorContainer", () => {
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
      render(<KitEditorContainer {...defaultProps} />);
      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
    });

    it("should render KitEditor with all buttons functional", () => {
      render(<KitEditorContainer {...defaultProps} />);

      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
      expect(screen.getByText("Back")).toBeInTheDocument();
      expect(screen.getByText("Message")).toBeInTheDocument();
      expect(screen.getByText("Reload")).toBeInTheDocument();
    });
  });

  describe("callback handling", () => {
    it("should handle onBack callback with parameters", async () => {
      render(<KitEditorContainer {...defaultProps} />);

      const backButton = screen.getByText("Back");
      backButton.click();

      expect(defaultProps.onBack).toHaveBeenCalledWith("test-kit");
    });

    it("should handle onMessage callback", () => {
      render(<KitEditorContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Test message",
        "info",
        5000,
      );
    });

    it("should handle onRequestSamplesReload callback", () => {
      render(<KitEditorContainer {...defaultProps} />);

      const reloadButton = screen.getByText("Reload");
      reloadButton.click();

      expect(defaultProps.onRequestSamplesReload).toHaveBeenCalled();
    });
  });

  describe("component behavior", () => {
    it("should handle prop changes gracefully", () => {
      const { rerender } = render(<KitEditorContainer {...defaultProps} />);

      // Rerender with different props
      rerender(<KitEditorContainer {...defaultProps} kitName="NewKit" />);

      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
    });

    it("should maintain callback functionality across renders", () => {
      const { rerender } = render(<KitEditorContainer {...defaultProps} />);

      const messageButton = screen.getByText("Message");
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(1);

      // Rerender and test again
      rerender(<KitEditorContainer {...defaultProps} />);
      messageButton.click();
      expect(defaultProps.onMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle empty kits array", () => {
      render(<KitEditorContainer {...defaultProps} kits={[]} />);
      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
    });

    it("should handle empty samples object", () => {
      render(<KitEditorContainer {...defaultProps} samples={{}} />);
      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
    });

    it("should handle null kit name", () => {
      render(<KitEditorContainer {...defaultProps} kitName="" />);
      expect(screen.getByTestId("kit-editor")).toBeInTheDocument();
    });
  });
});

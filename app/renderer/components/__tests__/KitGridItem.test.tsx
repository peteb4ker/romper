import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KitGridItem from "../KitGridItem";

// Mock dependencies
vi.mock("@romper/shared/kitUtilsShared", () => ({
  toCapitalCase: vi.fn((str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }),
}));

vi.mock("../hooks/useKitItem", () => ({
  useKitItem: vi.fn(() => ({
    iconLabel: "Test Icon",
    iconType: "drum",
  })),
}));

vi.mock("../shared/KitIconRenderer", () => ({
  KitIconRenderer: vi.fn(() => <div data-testid="kit-icon">Icon</div>),
}));

vi.mock("../shared/kitItemUtils", () => ({
  extractVoiceNames: vi.fn(() => ({
    1: "kick",
    2: "snare",
    3: "hihat",
    4: "percussion",
  })),
}));

import { extractVoiceNames } from "../shared/kitItemUtils";
const mockExtractVoiceNames = vi.mocked(extractVoiceNames);

describe("KitGridItem", () => {
  const defaultProps = {
    isSelected: false,
    isValid: true,
    kit: "A0",
    kitData: {
      editable: false,
      is_favorite: false,
      modified_since_sync: false,
    },
    onDuplicate: vi.fn(),
    onSelect: vi.fn(),
    sampleCounts: [4, 3, 2, 1],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders kit name and basic structure", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.getByText("A0")).toBeInTheDocument();
      expect(screen.getByTestId("kit-icon")).toBeInTheDocument();
      expect(screen.getByText("Icon")).toBeInTheDocument();
    });

    it("renders with proper data attributes", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("data-kit", "A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 10 samples");
    });

    it("renders icon renderer", () => {
      render(<KitGridItem {...defaultProps} />);

      const icon = screen.getByTestId("kit-icon");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Kit type styling", () => {
    it("applies invalid kit styling when isValid is false", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-l-4", "border-l-red-500");
      expect(container).toHaveClass("border-red-500");
    });

    it("applies unsaved changes styling when modified_since_sync is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-l-4", "border-l-amber-500");
    });

    it("applies editable kit styling when editable is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
        },
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-l-4", "border-l-green-500");
    });

    it("applies factory kit styling for read-only kits", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-l-4", "border-l-gray-400");
    });
  });

  describe("Selection state", () => {
    it("applies selection highlighting when selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={true} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("ring-2", "ring-blue-400");
      expect(container).toHaveAttribute("aria-selected", "true");
      expect(container).toHaveAttribute("tabindex", "0");
    });

    it("does not apply selection highlighting when not selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).not.toHaveClass("ring-2", "ring-blue-400");
      expect(container).toHaveAttribute("aria-selected", "false");
      expect(container).toHaveAttribute("tabindex", "-1");
    });
  });

  describe("High priority indicator", () => {
    it("shows high priority indicator for favorite kits", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true,
        },
      };
      render(<KitGridItem {...props} />);

      const indicator = screen.getByTitle(
        "High priority kit (favorite, modified, or well-loaded)"
      );
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("bg-orange-500");
    });

    it("shows high priority indicator for modified kits", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(
        screen.getByTitle(
          "High priority kit (favorite, modified, or well-loaded)"
        )
      ).toBeInTheDocument();
    });

    it("shows high priority indicator for well-loaded kits", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [8, 9, 10, 12], // Two voices with >= 8 samples
      };
      render(<KitGridItem {...props} />);

      expect(
        screen.getByTitle(
          "High priority kit (favorite, modified, or well-loaded)"
        )
      ).toBeInTheDocument();
    });

    it("does not show high priority indicator for regular kits", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(
        screen.queryByTitle(
          "High priority kit (favorite, modified, or well-loaded)"
        )
      ).not.toBeInTheDocument();
    });

    it("does not show high priority indicator for invalid kits", () => {
      const props = {
        ...defaultProps,
        isValid: false,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true, // Should be ignored for invalid kits
        },
      };
      render(<KitGridItem {...props} />);

      expect(
        screen.queryByTitle(
          "High priority kit (favorite, modified, or well-loaded)"
        )
      ).not.toBeInTheDocument();
    });
  });

  describe("Status badges", () => {
    it("shows unsaved badge when modified_since_sync is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("Unsaved")).toBeInTheDocument();
    });

    it("shows editable badge when editable and not modified", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
          modified_since_sync: false,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("Editable")).toBeInTheDocument();
    });

    it("prioritizes unsaved badge over editable badge", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("Unsaved")).toBeInTheDocument();
      expect(screen.queryByText("Editable")).not.toBeInTheDocument();
    });

    it("does not show badges for invalid kits", () => {
      const props = {
        ...defaultProps,
        isValid: false,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
      expect(screen.queryByText("Editable")).not.toBeInTheDocument();
    });
  });

  describe("Favorite button", () => {
    it("renders favorite button for valid kits when onToggleFavorite is provided", () => {
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          onToggleFavorite={mockOnToggleFavorite}
        />
      );

      const favoriteButton = screen.getByTitle("Add to favorites");
      expect(favoriteButton).toBeInTheDocument();
    });

    it("calls onToggleFavorite when favorite button is clicked", () => {
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          onToggleFavorite={mockOnToggleFavorite}
        />
      );

      const favoriteButton = screen.getByTitle("Add to favorites");
      fireEvent.click(favoriteButton);

      expect(mockOnToggleFavorite).toHaveBeenCalledWith("A0");
    });

    it("stops propagation when favorite button is clicked", () => {
      const mockOnSelect = vi.fn();
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          onSelect={mockOnSelect}
          onToggleFavorite={mockOnToggleFavorite}
        />
      );

      const favoriteButton = screen.getByTitle("Add to favorites");
      fireEvent.click(favoriteButton);

      expect(mockOnToggleFavorite).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("shows correct visual state when kit is favorited", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true,
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      const favoriteButton = screen.getByTitle("Remove from favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveClass("text-yellow-500");
    });

    it("does not render favorite button when onToggleFavorite is not provided", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.queryByTitle("Add to favorites")).not.toBeInTheDocument();
      expect(
        screen.queryByTitle("Remove from favorites")
      ).not.toBeInTheDocument();
    });

    it("renders favorite button for invalid kits when onToggleFavorite is provided", () => {
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          isValid={false}
          onToggleFavorite={mockOnToggleFavorite}
        />
      );

      expect(screen.getByTitle("Add to favorites")).toBeInTheDocument();
    });

    it("prioritizes isFavorite prop over kitData.is_favorite", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: true, // but prop says it is favorite
        kitData: {
          ...defaultProps.kitData,
          is_favorite: false, // kitData says not favorite
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      // Should show as favorited (using prop value)
      const favoriteButton = screen.getByTitle("Remove from favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveClass("text-yellow-500");
    });

    it("falls back to kitData.is_favorite when isFavorite prop is undefined", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: undefined, // No prop value provided
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true,
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      // Should fall back to kitData value
      const favoriteButton = screen.getByTitle("Remove from favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveClass("text-yellow-500");
    });

    it("uses false as default when both isFavorite prop and kitData.is_favorite are undefined", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: undefined, // No prop value
        kitData: undefined, // No kitData
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      // Should default to not favorited
      const favoriteButton = screen.getByTitle("Add to favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).not.toHaveClass("text-yellow-500");
    });

    it("handles explicit false isFavorite prop correctly", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: false, // but prop explicitly says not favorite
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true, // kitData says favorite
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      // Should use prop value (not favorited)
      const favoriteButton = screen.getByTitle("Add to favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).not.toHaveClass("text-yellow-500");
    });
  });

  describe("Duplicate button", () => {
    it("renders duplicate button for valid kits", () => {
      render(<KitGridItem {...defaultProps} />);

      const duplicateButton = screen.getByTitle("Duplicate kit");
      expect(duplicateButton).toBeInTheDocument();
    });

    it("calls onDuplicate when duplicate button is clicked", () => {
      const mockOnDuplicate = vi.fn();
      render(<KitGridItem {...defaultProps} onDuplicate={mockOnDuplicate} />);

      const duplicateButton = screen.getByTitle("Duplicate kit");
      fireEvent.click(duplicateButton);

      expect(mockOnDuplicate).toHaveBeenCalledTimes(1);
    });

    it("stops propagation when duplicate button is clicked", () => {
      const mockOnSelect = vi.fn();
      const mockOnDuplicate = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          onDuplicate={mockOnDuplicate}
          onSelect={mockOnSelect}
        />
      );

      const duplicateButton = screen.getByTitle("Duplicate kit");
      fireEvent.click(duplicateButton);

      expect(mockOnDuplicate).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it("does not render duplicate button for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      expect(screen.queryByTitle("Duplicate kit")).not.toBeInTheDocument();
    });
  });

  describe("Voice indicators", () => {
    it("renders voice indicators with sample counts", () => {
      render(<KitGridItem {...defaultProps} />);

      // Should render 4 voice indicators
      const voiceIndicators = screen.getAllByText(
        /Kick|Snare|Hihat|Percussion/
      );
      expect(voiceIndicators).toHaveLength(4);

      // Check sample count display
      expect(screen.getByText("Kick 4")).toBeInTheDocument();
      expect(screen.getByText("Snare 3")).toBeInTheDocument();
      expect(screen.getByText("Hihat 2")).toBeInTheDocument();
      expect(screen.getByText("Percussion 1")).toBeInTheDocument();
    });

    it("applies correct styling for empty voices", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [0, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const voiceWithZero = screen.getByText("Kick 0");
      expect(voiceWithZero).toHaveClass("bg-rose-200", "text-rose-800");
    });

    it("applies correct styling for full voices (12 samples)", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [12, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const fullVoice = screen.getByText("Kick 12");
      expect(fullVoice).toHaveClass("bg-lime-300", "font-bold");
    });

    it("applies correct styling for partial voices", () => {
      render(<KitGridItem {...defaultProps} />);

      const partialVoice = screen.getByText("Snare 3");
      expect(partialVoice).toHaveClass("bg-teal-300");
    });

    it("does not render voice indicators for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      expect(
        screen.queryByText(/Kick|Snare|Hihat|Percussion/)
      ).not.toBeInTheDocument();
    });

    it("handles missing voice names gracefully", () => {
      // Mock extractVoiceNames to return undefined voice names
      mockExtractVoiceNames.mockReturnValue({});

      render(<KitGridItem {...defaultProps} />);

      // Should still render counts without voice names, and tooltips should be without voice names
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();

      // Tooltips should not have voice names
      expect(screen.getByTitle("Voice 1: 4 samples")).toBeInTheDocument();
      expect(screen.getByTitle("Voice 2: 3 samples")).toBeInTheDocument();
      expect(screen.getByTitle("Voice 3: 2 samples")).toBeInTheDocument();
      expect(screen.getByTitle("Voice 4: 1 samples")).toBeInTheDocument();
    });
  });

  describe("Event handling", () => {
    it("calls onSelect when kit is clicked", () => {
      const mockOnSelect = vi.fn();
      render(<KitGridItem {...defaultProps} onSelect={mockOnSelect} />);

      const container = screen.getByTestId("kit-item-A0");
      fireEvent.click(container);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it("calls onSelect when Enter key is pressed", () => {
      const mockOnSelect = vi.fn();
      render(<KitGridItem {...defaultProps} onSelect={mockOnSelect} />);

      const container = screen.getByTestId("kit-item-A0");
      fireEvent.keyDown(container, { key: "Enter" });

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it("calls onSelect when Space key is pressed", () => {
      const mockOnSelect = vi.fn();
      render(<KitGridItem {...defaultProps} onSelect={mockOnSelect} />);

      const container = screen.getByTestId("kit-item-A0");
      fireEvent.keyDown(container, { key: " " });

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it("does not call onSelect for other keys", () => {
      const mockOnSelect = vi.fn();
      render(<KitGridItem {...defaultProps} onSelect={mockOnSelect} />);

      const container = screen.getByTestId("kit-item-A0");
      fireEvent.keyDown(container, { key: "Tab" });

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("role", "option");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 10 samples");
      expect(container).toHaveAttribute("aria-selected", "false");
    });

    it("has proper focus attributes", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass(
        "focus:outline-none",
        "focus-visible:ring-2"
      );
    });

    it("calculates aria-label correctly for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - Invalid kit");
    });

    it("has proper voice tooltips with voice names", () => {
      // Reset the mock to return voice names for this test
      mockExtractVoiceNames.mockReturnValue({
        1: "kick",
        2: "snare",
        3: "hihat",
        4: "percussion",
      });

      render(<KitGridItem {...defaultProps} />);

      // The tooltips should include voice names
      const voiceElement1 = screen.getByTitle("Voice 1: 4 samples (kick)");
      const voiceElement2 = screen.getByTitle("Voice 2: 3 samples (snare)");
      const voiceElement3 = screen.getByTitle("Voice 3: 2 samples (hihat)");
      const voiceElement4 = screen.getByTitle(
        "Voice 4: 1 samples (percussion)"
      );

      expect(voiceElement1).toBeInTheDocument();
      expect(voiceElement2).toBeInTheDocument();
      expect(voiceElement3).toBeInTheDocument();
      expect(voiceElement4).toBeInTheDocument();
    });
  });

  describe("Forward ref", () => {
    it("forwards ref correctly", () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<KitGridItem {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInTheDocument();
      expect(ref.current?.tagName).toBe("DIV");
    });
  });

  describe("Sample count calculations", () => {
    it("calculates total samples correctly", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [5, 7, 3, 2],
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 17 samples");
    });

    it("handles undefined sample counts", () => {
      const props = {
        ...defaultProps,
        sampleCounts: undefined,
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 0 samples");
    });

    it("handles partial sample counts array", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [5, 3], // Only 2 elements instead of 4
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 8 samples");
    });
  });
});

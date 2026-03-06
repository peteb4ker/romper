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

    it("applies consistent card styling for all states", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-border-subtle", "card-grain");
    });

    it("applies invalid styling when isValid is false", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("opacity-70", "cursor-not-allowed");
    });
  });

  describe("Status icons", () => {
    it("shows lock icon for factory (read-only) kits", () => {
      render(<KitGridItem {...defaultProps} />);

      const lock = screen.getByTestId("lock-icon");
      expect(lock).toBeInTheDocument();
      expect(lock).toHaveAttribute("title", "Factory kit (read-only)");
    });

    it("does not show lock icon for editable kits", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByTestId("lock-icon")).not.toBeInTheDocument();
    });

    it("does not show lock icon for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      expect(screen.queryByTestId("lock-icon")).not.toBeInTheDocument();
    });

    it("highlights card for modified/unsynced kits", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass(
        "border-accent-warning/40",
        "bg-accent-warning/5",
      );
    });

    it("does not highlight card when not modified", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).not.toHaveClass("border-accent-warning/40");
      expect(container).toHaveClass("border-border-subtle", "card-grain");
    });
  });

  describe("Selection state", () => {
    it("sets aria-selected and tabindex when selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={true} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-selected", "true");
      expect(container).toHaveAttribute("tabindex", "0");
    });

    it("sets aria-selected false and tabindex -1 when not selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-selected", "false");
      expect(container).toHaveAttribute("tabindex", "-1");
    });
  });

  describe("Favorite button", () => {
    it("renders favorite button for valid kits when onToggleFavorite is provided", () => {
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          onToggleFavorite={mockOnToggleFavorite}
        />,
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
        />,
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
        />,
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
      expect(favoriteButton).toHaveClass("text-accent-favorite");
    });

    it("does not render favorite button when onToggleFavorite is not provided", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.queryByTitle("Add to favorites")).not.toBeInTheDocument();
      expect(
        screen.queryByTitle("Remove from favorites"),
      ).not.toBeInTheDocument();
    });

    it("renders favorite button for invalid kits when onToggleFavorite is provided", () => {
      const mockOnToggleFavorite = vi.fn();
      render(
        <KitGridItem
          {...defaultProps}
          isValid={false}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      );

      expect(screen.getByTitle("Add to favorites")).toBeInTheDocument();
    });

    it("prioritizes isFavorite prop over kitData.is_favorite", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: true,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: false,
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      const favoriteButton = screen.getByTitle("Remove from favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveClass("text-accent-favorite");
    });

    it("falls back to kitData.is_favorite when isFavorite prop is undefined", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: undefined,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true,
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      const favoriteButton = screen.getByTitle("Remove from favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).toHaveClass("text-accent-favorite");
    });

    it("uses false as default when both isFavorite prop and kitData.is_favorite are undefined", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: undefined,
        kitData: undefined,
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      const favoriteButton = screen.getByTitle("Add to favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).not.toHaveClass("text-accent-favorite");
    });

    it("handles explicit false isFavorite prop correctly", () => {
      const mockOnToggleFavorite = vi.fn();
      const props = {
        ...defaultProps,
        isFavorite: false,
        kitData: {
          ...defaultProps.kitData,
          is_favorite: true,
        },
        onToggleFavorite: mockOnToggleFavorite,
      };
      render(<KitGridItem {...props} />);

      const favoriteButton = screen.getByTitle("Add to favorites");
      expect(favoriteButton).toBeInTheDocument();
      expect(favoriteButton).not.toHaveClass("text-accent-favorite");
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
        />,
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

  describe("Voice channel strip", () => {
    it("renders voice counts with names", () => {
      render(<KitGridItem {...defaultProps} />);

      // Check voice alias names are rendered
      expect(screen.getByText("Kick")).toBeInTheDocument();
      expect(screen.getByText("Snare")).toBeInTheDocument();
      expect(screen.getByText("Hihat")).toBeInTheDocument();
      expect(screen.getByText("Percussion")).toBeInTheDocument();

      // Check counts are rendered
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("applies danger color for empty voices (0 samples)", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [0, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const countText = screen.getByText("0");
      expect(countText).toHaveClass("text-accent-danger");
    });

    it("applies success color and bold for full voices (12 samples)", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [12, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const countText = screen.getByText("12");
      expect(countText).toHaveClass("text-accent-success", "font-bold");
    });

    it("applies primary color for partial voices", () => {
      render(<KitGridItem {...defaultProps} />);

      const countText = screen.getByText("3");
      expect(countText).toHaveClass("text-accent-primary");
    });

    it("does not render voice strip for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      expect(screen.queryByText("Kick")).not.toBeInTheDocument();
    });

    it("handles missing voice names gracefully with empty placeholder", () => {
      mockExtractVoiceNames.mockReturnValue({});

      render(<KitGridItem {...defaultProps} />);

      // Should still render counts
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
        "focus-visible:ring-2",
      );
    });

    it("calculates aria-label correctly for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - Invalid kit");
    });

    it("has proper voice tooltips with voice names", () => {
      mockExtractVoiceNames.mockReturnValue({
        1: "kick",
        2: "snare",
        3: "hihat",
        4: "percussion",
      });

      render(<KitGridItem {...defaultProps} />);

      expect(
        screen.getByTitle("Voice 1: 4 samples (kick)"),
      ).toBeInTheDocument();
      expect(
        screen.getByTitle("Voice 2: 3 samples (snare)"),
      ).toBeInTheDocument();
      expect(
        screen.getByTitle("Voice 3: 2 samples (hihat)"),
      ).toBeInTheDocument();
      expect(
        screen.getByTitle("Voice 4: 1 samples (percussion)"),
      ).toBeInTheDocument();
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
        sampleCounts: [5, 3],
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveAttribute("aria-label", "Kit A0 - 8 samples");
    });
  });

  describe("Search match indicators", () => {
    it("renders artist badge when searchMatch has matched artist", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedArtist: "Test Artist",
            matchedOn: ["artist"],
            matchedSamples: [],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByTestId("icon-music-note")).toBeInTheDocument();
      expect(screen.getByText(/Test Artist/)).toBeInTheDocument();
    });

    it("highlights matched portion of alias inline instead of showing badge", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          alias: "My Custom Kit",
          searchMatch: {
            matchedAlias: "My Custom Kit",
            matchedOn: ["alias"],
            matchedSamples: [],
            matchedVoices: [],
            searchTerm: "custom",
          },
        },
      };
      render(<KitGridItem {...props} />);

      // No alias badge
      expect(screen.queryByTestId("icon-tag")).not.toBeInTheDocument();
      // Alias text still visible with highlighted portion
      const highlighted = screen.getByText("Custom");
      expect(highlighted.tagName).toBe("MARK");
      expect(highlighted).toHaveClass(
        "bg-accent-primary/25",
        "text-accent-primary",
      );
    });

    it("does not render sample badge (samples shown in voice strip instead)", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["kick_001.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByTestId("icon-file-audio")).not.toBeInTheDocument();
    });

    it("does not render search badges when no searchMatch data", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.queryByTestId("icon-music-note")).not.toBeInTheDocument();
    });

    it("does not render search badges when kit is invalid", () => {
      const props = {
        ...defaultProps,
        isValid: false,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedArtist: "Test",
            matchedOn: ["artist"],
            matchedSamples: [],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByTestId("icon-music-note")).not.toBeInTheDocument();
    });
  });

  describe("Voice strip with search matches", () => {
    it("shows matched filenames in corresponding voice columns", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:kick_001.wav"],
            matchedSamples: ["kick_001.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      const matchContainer = screen.getByTestId("voice-1-matches");
      expect(matchContainer).toBeInTheDocument();
      expect(screen.getByText("kick_001")).toBeInTheDocument();
    });

    it("strips file extensions from displayed filenames", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:snare_hit.wav"],
            matchedSamples: ["snare_hit.wav"],
            matchedSamplesByVoice: { 2: ["snare_hit.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("snare_hit")).toBeInTheDocument();
      expect(screen.queryByText("snare_hit.wav")).not.toBeInTheDocument();
    });

    it("dims non-matching voice columns", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:kick_001.wav"],
            matchedSamples: ["kick_001.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      // Voice 2 (snare) should be dimmed since no matches
      const voice2 = screen.getByTitle("Voice 2: 3 samples (snare)");
      expect(voice2).toHaveClass("opacity-30");
    });

    it("shows multiple matched filenames in a voice column", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:kick_001.wav", "sample:kick_002.wav"],
            matchedSamples: ["kick_001.wav", "kick_002.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav", "kick_002.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("kick_001")).toBeInTheDocument();
      expect(screen.getByText("kick_002")).toBeInTheDocument();
    });

    it("shows normal counts when no matchedSamplesByVoice", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["name"],
            matchedSamples: [],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      // Normal voice counts should still display
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("hides counts for non-matching voices when voice matches exist", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:kick_001.wav"],
            matchedSamples: ["kick_001.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      // Voice 1 shows filename, not count
      expect(screen.getByText("kick_001")).toBeInTheDocument();
      // Voices 2-4 should not show their counts (3, 2, 1)
      expect(screen.queryByText("3")).not.toBeInTheDocument();
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("shows 'Voice N' fallback label when no voice alias during search", () => {
      mockExtractVoiceNames.mockReturnValue({});

      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample:kick_001.wav"],
            matchedSamples: ["kick_001.wav"],
            matchedSamplesByVoice: { 1: ["kick_001.wav"] },
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByText("Voice 1")).toBeInTheDocument();
      expect(screen.getByText("Voice 2")).toBeInTheDocument();
      expect(screen.getByText("Voice 3")).toBeInTheDocument();
      expect(screen.getByText("Voice 4")).toBeInTheDocument();
    });
  });

  describe("Stereo indicator", () => {
    it("should show stereo icon when kit has stereo-linked voices", () => {
      render(
        <KitGridItem
          {...defaultProps}
          kitData={
            {
              ...defaultProps.kitData,
              voices: [
                {
                  id: 1,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: true,
                  voice_alias: null,
                  voice_number: 1,
                  voice_volume: 100,
                },
                {
                  id: 2,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: false,
                  voice_alias: null,
                  voice_number: 2,
                  voice_volume: 100,
                },
              ],
            } as never
          }
        />,
      );

      expect(screen.getByTestId("stereo-indicator")).toBeInTheDocument();
    });

    it("should highlight stereo icon when search matches stereo", () => {
      render(
        <KitGridItem
          {...defaultProps}
          kitData={
            {
              ...defaultProps.kitData,
              searchMatch: {
                matchedOn: ["stereo"],
                matchedSamples: [],
                matchedVoices: [],
                searchTerm: "stereo",
              },
              voices: [
                {
                  id: 1,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: true,
                  voice_alias: null,
                  voice_number: 1,
                  voice_volume: 100,
                },
              ],
            } as never
          }
        />,
      );

      const indicator = screen.getByTestId("stereo-indicator");
      expect(indicator.className).toContain("text-accent-primary");
    });

    it("should not show stereo icon when no voices have stereo_mode", () => {
      render(
        <KitGridItem
          {...defaultProps}
          kitData={
            {
              ...defaultProps.kitData,
              voices: [
                {
                  id: 1,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: false,
                  voice_alias: null,
                  voice_number: 1,
                  voice_volume: 100,
                },
              ],
            } as never
          }
        />,
      );

      expect(screen.queryByTestId("stereo-indicator")).not.toBeInTheDocument();
    });
  });

  describe("Voice names on empty kits", () => {
    it("should show voice names when kit has no samples", () => {
      mockExtractVoiceNames.mockReturnValue({ 1: "kick", 2: "snare" });
      render(
        <KitGridItem
          {...defaultProps}
          kitData={
            {
              ...defaultProps.kitData,
              voices: [
                {
                  id: 1,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: false,
                  voice_alias: "kick",
                  voice_number: 1,
                  voice_volume: 100,
                },
                {
                  id: 2,
                  kit_name: "A0",
                  sample_mode: "first",
                  stereo_mode: false,
                  voice_alias: "snare",
                  voice_number: 2,
                  voice_volume: 100,
                },
              ],
            } as never
          }
          sampleCounts={undefined as never}
        />,
      );

      expect(screen.getByText("Kick")).toBeInTheDocument();
      expect(screen.getByText("Snare")).toBeInTheDocument();
    });
  });
});

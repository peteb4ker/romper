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

  describe("Kit state LED indicators", () => {
    it("renders state LED dot", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.getByTestId("state-led")).toBeInTheDocument();
    });

    it("applies factory state styling for read-only kits", () => {
      render(<KitGridItem {...defaultProps} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-border-subtle", "bg-surface-1");
      expect(container).not.toHaveClass("border-accent-warning/40");
    });

    it("applies invalid state styling when isValid is false", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-accent-danger/40", "opacity-70");
      const led = screen.getByTestId("state-led");
      expect(led).toHaveClass("bg-accent-danger");
    });

    it("applies modified state styling when modified_since_sync is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-accent-warning/40");
      const led = screen.getByTestId("state-led");
      expect(led).toHaveClass("bg-accent-warning");
    });

    it("applies editable state styling when editable is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
        },
      };
      render(<KitGridItem {...props} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("border-border-subtle");
      const led = screen.getByTestId("state-led");
      expect(led).toHaveClass("bg-accent-success");
    });
  });

  describe("Selection state", () => {
    it("applies selection highlighting when selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={true} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).toHaveClass("ring-2", "ring-accent-primary");
      expect(container).toHaveAttribute("aria-selected", "true");
      expect(container).toHaveAttribute("tabindex", "0");
    });

    it("does not apply selection highlighting when not selected", () => {
      render(<KitGridItem {...defaultProps} isSelected={false} />);

      const container = screen.getByTestId("kit-item-A0");
      expect(container).not.toHaveClass("ring-2", "ring-accent-primary");
      expect(container).toHaveAttribute("aria-selected", "false");
      expect(container).toHaveAttribute("tabindex", "-1");
    });
  });

  describe("Status badges", () => {
    it("shows MOD badge when modified_since_sync is true", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          modified_since_sync: true,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByTestId("mod-badge")).toBeInTheDocument();
      expect(screen.getByText("MOD")).toBeInTheDocument();
    });

    it("does not show MOD badge for editable kits without modifications", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          editable: true,
          modified_since_sync: false,
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByTestId("mod-badge")).not.toBeInTheDocument();
    });

    it("does not show MOD badge for factory kits", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.queryByTestId("mod-badge")).not.toBeInTheDocument();
    });

    it("does not show MOD badge for invalid kits", () => {
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

      expect(screen.queryByTestId("mod-badge")).not.toBeInTheDocument();
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
      expect(favoriteButton).toHaveClass("text-accent-warning");
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
      expect(favoriteButton).toHaveClass("text-accent-warning");
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
      expect(favoriteButton).toHaveClass("text-accent-warning");
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
      expect(favoriteButton).not.toHaveClass("text-accent-warning");
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
      expect(favoriteButton).not.toHaveClass("text-accent-warning");
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
    it("renders voice LED dots with sample counts", () => {
      render(<KitGridItem {...defaultProps} />);

      // Check LED dots exist
      expect(screen.getByTestId("voice-led-1")).toBeInTheDocument();
      expect(screen.getByTestId("voice-led-2")).toBeInTheDocument();
      expect(screen.getByTestId("voice-led-3")).toBeInTheDocument();
      expect(screen.getByTestId("voice-led-4")).toBeInTheDocument();

      // Check voice alias names are rendered
      expect(screen.getByText("Kick")).toBeInTheDocument();
      expect(screen.getByText("Snare")).toBeInTheDocument();
      expect(screen.getByText("Hihat")).toBeInTheDocument();
      expect(screen.getByText("Percussion")).toBeInTheDocument();

      // Check counts are rendered separately
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("applies correct LED styling for empty voices (0 samples)", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [0, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const led = screen.getByTestId("voice-led-1");
      expect(led).toHaveClass("bg-accent-danger");
    });

    it("applies correct LED styling for full voices (12 samples)", () => {
      const props = {
        ...defaultProps,
        sampleCounts: [12, 3, 2, 1],
      };
      render(<KitGridItem {...props} />);

      const led = screen.getByTestId("voice-led-1");
      expect(led).toHaveClass("bg-accent-success");
    });

    it("applies correct LED styling for partial voices", () => {
      render(<KitGridItem {...defaultProps} />);

      const led = screen.getByTestId("voice-led-2");
      expect(led).toHaveClass("bg-accent-primary");
    });

    it("does not render voice strip for invalid kits", () => {
      render(<KitGridItem {...defaultProps} isValid={false} />);

      expect(screen.queryByTestId("voice-led-1")).not.toBeInTheDocument();
    });

    it("handles missing voice names gracefully", () => {
      mockExtractVoiceNames.mockReturnValue({});

      render(<KitGridItem {...defaultProps} />);

      // Should still render counts without voice names
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
    it("renders search match badges with Phosphor icons when searchMatch data is present", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedArtist: "Test Artist",
            matchedOn: ["sample", "artist"],
            matchedSamples: ["kick_001.wav", "snare_001.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      // Check for Phosphor FileAudio icon
      expect(screen.getByTestId("icon-file-audio")).toBeInTheDocument();

      // Check for sample count
      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(sampleBadge).toHaveTextContent("2");

      // Check for Phosphor MusicNote icon and artist text
      expect(screen.getByTestId("icon-music-note")).toBeInTheDocument();
      expect(screen.getByText(/Test Artist/)).toBeInTheDocument();
    });

    it("renders alias match badge with Tag icon", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedAlias: "My Custom Kit",
            matchedOn: ["alias"],
            matchedSamples: [],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.getByTestId("icon-tag")).toBeInTheDocument();
      expect(screen.getByText(/My Custom Kit/)).toBeInTheDocument();
    });

    it("shows single sample without count", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["single_sample.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(screen.getByTestId("icon-file-audio")).toBeInTheDocument();
      // Should not show count "1"
      expect(sampleBadge).not.toHaveTextContent("1");
    });

    it("does not render search badges when no searchMatch data", () => {
      render(<KitGridItem {...defaultProps} />);

      expect(screen.queryByTitle(/Sample matches:/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-file-audio")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-music-note")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-tag")).not.toBeInTheDocument();
    });

    it("does not render search badges when kit is invalid", () => {
      const props = {
        ...defaultProps,
        isValid: false,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["test.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      expect(screen.queryByTitle(/Sample matches:/)).not.toBeInTheDocument();
    });

    it("has proper tooltip for sample matches", () => {
      const props = {
        ...defaultProps,
        kitData: {
          ...defaultProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["kick.wav", "snare.wav", "hihat.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitGridItem {...props} />);

      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(sampleBadge).toBeInTheDocument();
      expect(sampleBadge).toHaveAttribute(
        "title",
        "Sample matches:\nkick.wav\nsnare.wav\nhihat.wav",
      );
    });
  });
});

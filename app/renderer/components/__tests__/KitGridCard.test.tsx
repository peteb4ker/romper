import type { Kit } from "@romper/shared/db/schema.js";

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock isValidKit before importing the component
vi.mock("@romper/shared/kitUtilsShared", () => ({
  isValidKit: vi.fn((name: string) => /^\p{Lu}\d{1,2}$/u.test(name)),
}));

// Mock KitGridItem to capture the props it receives
const mockKitGridItem = vi.fn(() => (
  <div data-testid="mock-kit-grid-item">MockKitGridItem</div>
));

vi.mock("../KitGridItem", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockKitGridItem(props);
    return <div data-testid={`kit-item-${props.kit}`}>MockKitGridItem</div>;
  },
}));

import { isValidKit } from "@romper/shared/kitUtilsShared";

import { KitGridCard } from "../KitGridCard";

const mockIsValidKit = vi.mocked(isValidKit);

describe("KitGridCard", () => {
  const kitA0: Kit = {
    alias: null,
    artist: null,
    bank_letter: "A",
    bpm: 120,
    editable: false,
    is_favorite: false,
    locked: false,
    modified_since_sync: false,
    name: "A0",
    step_pattern: null,
  };

  const kitB3: Kit = {
    alias: null,
    artist: null,
    bank_letter: "B",
    bpm: 120,
    editable: false,
    is_favorite: false,
    locked: false,
    modified_since_sync: false,
    name: "B3",
    step_pattern: null,
  };

  const kitsToDisplay: Kit[] = [kitA0, kitB3];

  const defaultProps = {
    focusedIdx: null as null | number,
    kit: kitA0,
    kitsToDisplay,
    onDuplicate: vi.fn(),
    onSelectKit: vi.fn(),
    setFocus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidKit.mockImplementation((name: string) =>
      /^\p{Lu}\d{1,2}$/u.test(name),
    );
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders the component with a wrapper div", () => {
      const { container } = render(<KitGridCard {...defaultProps} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toBeInTheDocument();
      expect(wrapper.tagName).toBe("DIV");
      expect(wrapper.style.height).toBe("90px");
    });

    it("renders the KitGridItem child", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(screen.getByTestId("kit-item-A0")).toBeInTheDocument();
    });
  });

  describe("Props passed to KitGridItem", () => {
    it("passes kit name as the kit prop", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ kit: "A0" }),
      );
    });

    it("passes isValid based on isValidKit result", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isValid: true }),
      );
    });

    it("passes isValid as false for invalid kit names", () => {
      mockIsValidKit.mockReturnValue(false);

      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isValid: false }),
      );
    });

    it("passes isSelected as true when focusedIdx matches kit index", () => {
      render(<KitGridCard {...defaultProps} focusedIdx={0} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isSelected: true }),
      );
    });

    it("passes isSelected as false when focusedIdx does not match", () => {
      render(<KitGridCard {...defaultProps} focusedIdx={1} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isSelected: false }),
      );
    });

    it("passes isSelected as false when focusedIdx is null", () => {
      render(<KitGridCard {...defaultProps} focusedIdx={null} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isSelected: false }),
      );
    });

    it("passes sampleCounts for the correct kit", () => {
      const sampleCounts = {
        A0: [4, 3, 2, 1] as [number, number, number, number],
        B3: [1, 2, 3, 4] as [number, number, number, number],
      };

      render(<KitGridCard {...defaultProps} sampleCounts={sampleCounts} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleCounts: [4, 3, 2, 1],
        }),
      );
    });

    it("passes undefined sampleCounts when not provided", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ sampleCounts: undefined }),
      );
    });

    it("passes undefined sampleCounts when kit is not in the map", () => {
      const sampleCounts = {
        B3: [1, 2, 3, 4] as [number, number, number, number],
      };

      render(<KitGridCard {...defaultProps} sampleCounts={sampleCounts} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ sampleCounts: undefined }),
      );
    });

    it("passes data-testid with kit name", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ "data-testid": "kit-item-A0" }),
      );
    });

    it("passes data-kit with kit name", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ "data-kit": "A0" }),
      );
    });

    it("passes onToggleFavorite when provided", () => {
      const mockOnToggleFavorite = vi.fn();

      render(
        <KitGridCard
          {...defaultProps}
          onToggleFavorite={mockOnToggleFavorite}
        />,
      );

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({
          onToggleFavorite: mockOnToggleFavorite,
        }),
      );
    });
  });

  describe("kitData resolution", () => {
    it("passes matching kitData item from kitData array", () => {
      const kitData = [
        {
          ...kitA0,
          editable: true,
          is_favorite: true,
          modified_since_sync: false,
        },
      ];

      render(<KitGridCard {...defaultProps} kitData={kitData} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({
          kitData: expect.objectContaining({
            editable: true,
            is_favorite: true,
            name: "A0",
          }),
        }),
      );
    });

    it("passes null kitData when no matching item found", () => {
      const kitData = [
        {
          ...kitB3,
          editable: false,
          is_favorite: false,
          modified_since_sync: false,
        },
      ];

      render(<KitGridCard {...defaultProps} kitData={kitData} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ kitData: null }),
      );
    });

    it("passes null kitData when kitData is undefined", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ kitData: null }),
      );
    });

    it("passes null kitData when kitData is null", () => {
      render(<KitGridCard {...defaultProps} kitData={null} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ kitData: null }),
      );
    });
  });

  describe("Favorite state computation", () => {
    it("uses getKitFavoriteState when provided", () => {
      const mockGetFavoriteState = vi.fn().mockReturnValue(true);

      render(
        <KitGridCard
          {...defaultProps}
          getKitFavoriteState={mockGetFavoriteState}
        />,
      );

      expect(mockGetFavoriteState).toHaveBeenCalledWith("A0");
      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isFavorite: true }),
      );
    });

    it("falls back to kitData.is_favorite when getKitFavoriteState is not provided", () => {
      const kitData = [{ ...kitA0, is_favorite: true }];

      render(<KitGridCard {...defaultProps} kitData={kitData} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isFavorite: true }),
      );
    });

    it("passes undefined isFavorite when neither source is available", () => {
      render(<KitGridCard {...defaultProps} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isFavorite: undefined }),
      );
    });
  });

  describe("onSelect handler", () => {
    it("calls onSelectKit, onFocusKit, and setFocus when valid kit is selected", () => {
      const mockOnFocusKit = vi.fn();
      const mockOnSelectKit = vi.fn();
      const mockSetFocus = vi.fn();

      render(
        <KitGridCard
          {...defaultProps}
          onFocusKit={mockOnFocusKit}
          onSelectKit={mockOnSelectKit}
          setFocus={mockSetFocus}
        />,
      );

      // Get the onSelect prop that was passed to KitGridItem
      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onSelectHandler = passedProps.onSelect as () => void;
      onSelectHandler();

      expect(mockOnSelectKit).toHaveBeenCalledWith("A0");
      expect(mockOnFocusKit).toHaveBeenCalledWith("A0");
      expect(mockSetFocus).toHaveBeenCalledWith(0);
    });

    it("does not call callbacks when invalid kit is selected", () => {
      mockIsValidKit.mockReturnValue(false);
      const mockOnSelectKit = vi.fn();
      const mockSetFocus = vi.fn();

      render(
        <KitGridCard
          {...defaultProps}
          onSelectKit={mockOnSelectKit}
          setFocus={mockSetFocus}
        />,
      );

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onSelectHandler = passedProps.onSelect as () => void;
      onSelectHandler();

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(mockSetFocus).not.toHaveBeenCalled();
    });

    it("works without onFocusKit callback", () => {
      const mockOnSelectKit = vi.fn();
      const mockSetFocus = vi.fn();

      render(
        <KitGridCard
          {...defaultProps}
          onSelectKit={mockOnSelectKit}
          setFocus={mockSetFocus}
        />,
      );

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onSelectHandler = passedProps.onSelect as () => void;
      onSelectHandler();

      expect(mockOnSelectKit).toHaveBeenCalledWith("A0");
      expect(mockSetFocus).toHaveBeenCalledWith(0);
    });
  });

  describe("onDuplicate handler", () => {
    it("calls onDuplicate with kit name for valid kits", () => {
      const mockOnDuplicate = vi.fn();

      render(<KitGridCard {...defaultProps} onDuplicate={mockOnDuplicate} />);

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onDuplicateHandler = passedProps.onDuplicate as () => void;
      onDuplicateHandler();

      expect(mockOnDuplicate).toHaveBeenCalledWith("A0");
    });

    it("does not call onDuplicate for invalid kits", () => {
      mockIsValidKit.mockReturnValue(false);
      const mockOnDuplicate = vi.fn();

      render(<KitGridCard {...defaultProps} onDuplicate={mockOnDuplicate} />);

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onDuplicateHandler = passedProps.onDuplicate as () => void;
      onDuplicateHandler();

      expect(mockOnDuplicate).not.toHaveBeenCalled();
    });
  });

  describe("Index calculation", () => {
    it("calculates correct global index for first kit in list", () => {
      const mockSetFocus = vi.fn();

      render(
        <KitGridCard {...defaultProps} kit={kitA0} setFocus={mockSetFocus} />,
      );

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onSelectHandler = passedProps.onSelect as () => void;
      onSelectHandler();

      expect(mockSetFocus).toHaveBeenCalledWith(0);
    });

    it("calculates correct global index for second kit in list", () => {
      const mockSetFocus = vi.fn();

      render(
        <KitGridCard {...defaultProps} kit={kitB3} setFocus={mockSetFocus} />,
      );

      const passedProps = mockKitGridItem.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const onSelectHandler = passedProps.onSelect as () => void;
      onSelectHandler();

      expect(mockSetFocus).toHaveBeenCalledWith(1);
    });

    it("uses correct index for isSelected check with second kit", () => {
      render(<KitGridCard {...defaultProps} focusedIdx={1} kit={kitB3} />);

      expect(mockKitGridItem).toHaveBeenCalledWith(
        expect.objectContaining({ isSelected: true }),
      );
    });
  });
});

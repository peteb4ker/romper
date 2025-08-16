import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitGrid, { type KitGridHandle } from "../KitGrid";

const mockKits = [
  {
    alias: null,
    artist: null,
    bank_letter: "A",
    editable: false,
    locked: false,
    modified_since_sync: false,
    name: "AKit1",
    samples: [],
    step_pattern: null,
    voices: [],
  },
  {
    alias: null,
    artist: null,
    bank_letter: "A",
    editable: false,
    locked: false,
    modified_since_sync: false,
    name: "AKit2",
    samples: [],
    step_pattern: null,
    voices: [],
  },
  {
    alias: null,
    artist: null,
    bank_letter: "B",
    editable: false,
    locked: false,
    modified_since_sync: false,
    name: "BKit3",
    samples: [],
    step_pattern: null,
    voices: [],
  },
];

const baseProps = {
  bankNames: { A: "Bank A", B: "Bank B", C: "Bank C" },
  kits: mockKits,
  onDuplicate: vi.fn(),
  onSelectKit: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  setupElectronAPIMock();
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("KitGrid", () => {
  it("renders bank headers", () => {
    render(<KitGrid {...baseProps} />);

    // Use getAllByText since there might be multiple "Bank A" elements
    const bankAElements = screen.getAllByText("Bank A");
    expect(bankAElements.length).toBeGreaterThan(0);

    const bankBElements = screen.getAllByText("Bank B");
    expect(bankBElements.length).toBeGreaterThan(0);
  });

  it("renders kit items", () => {
    render(<KitGrid {...baseProps} />);

    expect(screen.getByText("AKit1")).toBeInTheDocument();
    expect(screen.getByText("AKit2")).toBeInTheDocument();
    expect(screen.getByText("BKit3")).toBeInTheDocument();
  });

  it("renders with proper test ids", () => {
    render(<KitGrid {...baseProps} />);

    expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
    expect(screen.getByTestId("kit-item-AKit1")).toBeInTheDocument();
    expect(screen.getByTestId("kit-item-AKit2")).toBeInTheDocument();
    expect(screen.getByTestId("kit-item-BKit3")).toBeInTheDocument();
  });

  describe("Keyboard navigation", () => {
    it("does not throw errors on keyboard events", () => {
      render(<KitGrid {...baseProps} />);

      const grid = screen.getByTestId("kit-grid");

      // These should not throw errors, testing that keyboard event handlers exist
      expect(() => {
        fireEvent.keyDown(grid, { key: "A" });
        fireEvent.keyDown(grid, { key: "B" });
        fireEvent.keyDown(grid, { key: "Enter" });
        fireEvent.keyDown(grid, { key: " " });
        fireEvent.keyDown(grid, { key: "ArrowDown" });
        fireEvent.keyDown(grid, { key: "ArrowUp" });
        fireEvent.keyDown(grid, { key: "ArrowLeft" });
        fireEvent.keyDown(grid, { key: "ArrowRight" });
      }).not.toThrow();
    });

    it("ignores invalid key presses without errors", () => {
      render(<KitGrid {...baseProps} />);

      const grid = screen.getByTestId("kit-grid");

      // These keys should not cause errors
      expect(() => {
        fireEvent.keyDown(grid, { key: "Tab" });
        fireEvent.keyDown(grid, { key: "Escape" });
        fireEvent.keyDown(grid, { key: "Delete" });
        fireEvent.keyDown(grid, { key: "1" });
        fireEvent.keyDown(grid, { key: "!" });
      }).not.toThrow();
    });
  });

  it("handles empty kits array", () => {
    render(<KitGrid {...baseProps} kits={[]} />);

    // Should not throw errors with empty kits
    expect(screen.queryByText("AKit1")).not.toBeInTheDocument();
  });

  it("renders properly with minimal props", () => {
    const minimalProps = {
      bankNames: {},
      kits: [],
      onDuplicate: vi.fn(),
      onSelectKit: vi.fn(),
    };

    render(<KitGrid {...minimalProps} />);

    // Should render without errors even with minimal props
    expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
  });

  it("accepts all required props without errors", () => {
    const onDuplicate = vi.fn();
    const onSelectKit = vi.fn();

    // Test that all props are accepted without throwing errors
    expect(() => {
      render(
        <KitGrid
          {...baseProps}
          onDuplicate={onDuplicate}
          onSelectKit={onSelectKit}
        />,
      );
    }).not.toThrow();

    expect(onDuplicate).toBeDefined();
    expect(onSelectKit).toBeDefined();
  });

  describe("imperative handle", () => {
    it("exposes scrollToKit method", () => {
      const ref = createRef<KitGridHandle>();
      render(<KitGrid {...baseProps} ref={ref} />);

      // Verify the method exists
      expect(ref.current?.scrollToKit).toBeDefined();
      expect(typeof ref.current?.scrollToKit).toBe("function");
    });

    it("exposes scrollAndFocusKitByIndex method", () => {
      const ref = createRef<KitGridHandle>();
      render(<KitGrid {...baseProps} ref={ref} />);

      // Verify the method exists
      expect(ref.current?.scrollAndFocusKitByIndex).toBeDefined();
      expect(typeof ref.current?.scrollAndFocusKitByIndex).toBe("function");
    });

    it("scrollToKit can be called without error for existing kit", () => {
      const ref = createRef<KitGridHandle>();
      render(<KitGrid {...baseProps} ref={ref} />);

      // Call scrollToKit for existing kit - should not throw
      expect(() => {
        ref.current?.scrollToKit("AKit2");
      }).not.toThrow();
    });

    it("scrollToKit can be called without error for non-existent kit", () => {
      const ref = createRef<KitGridHandle>();
      render(<KitGrid {...baseProps} ref={ref} />);

      // Call scrollToKit for non-existent kit - should not throw
      expect(() => {
        ref.current?.scrollToKit("NonExistentKit");
      }).not.toThrow();
    });
  });

  describe("getKitFavoriteState prop", () => {
    it("passes getKitFavoriteState to KitGrid component", () => {
      const mockGetKitFavoriteState = vi.fn(() => true);

      expect(() => {
        render(
          <KitGrid
            {...baseProps}
            getKitFavoriteState={mockGetKitFavoriteState}
          />,
        );
      }).not.toThrow();
    });

    it("renders without getKitFavoriteState prop", () => {
      // Should render normally without the optional prop
      expect(() => {
        render(<KitGrid {...baseProps} />);
      }).not.toThrow();

      expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
    });

    it("accepts getKitFavoriteState function prop", () => {
      const mockGetKitFavoriteState = vi.fn((kitName: string) => {
        return kitName === "AKit1"; // AKit1 is favorite, others are not
      });

      render(
        <KitGrid
          {...baseProps}
          getKitFavoriteState={mockGetKitFavoriteState}
        />,
      );

      // Component should render successfully with the prop
      expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
      expect(screen.getByText("AKit1")).toBeInTheDocument();
    });

    it("works with kitData prop for favorite state fallback", () => {
      const kitDataWithFavorites = [
        {
          alias: null,
          artist: null,
          bank_letter: "A",
          editable: false,
          id: 1,
          is_favorite: true,
          locked: false,
          modified_since_sync: false,
          name: "AKit1",
          samples: [],
          step_pattern: null,
          voices: [],
        },
        {
          alias: null,
          artist: null,
          bank_letter: "A",
          editable: false,
          id: 2,
          is_favorite: false,
          locked: false,
          modified_since_sync: false,
          name: "AKit2",
          samples: [],
          step_pattern: null,
          voices: [],
        },
      ];

      expect(() => {
        render(
          <KitGrid
            {...baseProps}
            kitData={kitDataWithFavorites}
            kits={kitDataWithFavorites}
          />,
        );
      }).not.toThrow();

      expect(screen.getByTestId("kit-grid")).toBeInTheDocument();
    });
  });
});

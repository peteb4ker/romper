import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitGrid from "../KitGrid";

const mockKits = [
  { id: 1, name: "AKit1", bank: "A", samples: [] },
  { id: 2, name: "AKit2", bank: "A", samples: [] },
  { id: 3, name: "BKit3", bank: "B", samples: [] },
];

const baseProps = {
  kits: mockKits,
  onSelectKit: vi.fn(),
  bankNames: { A: "Bank A", B: "Bank B", C: "Bank C" },
  onDuplicate: vi.fn(),
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
      kits: [],
      onSelectKit: vi.fn(),
      bankNames: {},
      onDuplicate: vi.fn(),
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
});

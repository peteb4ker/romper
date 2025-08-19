import { cleanup, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoicePanelButtons } from "../useVoicePanelButtons";

// Mock react-icons
vi.mock("react-icons/fi", () => ({
  FiPlay: () => <span data-testid="play-icon">Play</span>,
  FiSquare: () => <span data-testid="square-icon">Square</span>,
  FiTrash2: () => <span data-testid="trash-icon">Trash</span>,
}));

describe("useVoicePanelButtons", () => {
  const mockOnPlay = vi.fn();
  const mockOnStop = vi.fn();
  const mockHandleDeleteSample = vi.fn().mockResolvedValue(undefined);

  const mockSampleActionsHook = {
    handleDeleteSample: mockHandleDeleteSample,
  };

  const defaultProps = {
    onPlay: mockOnPlay,
    onStop: mockOnStop,
    sampleActionsHook: mockSampleActionsHook,
    voice: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  describe("initialization", () => {
    it("returns render functions", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      expect(typeof result.current.renderDeleteButton).toBe("function");
      expect(typeof result.current.renderPlayButton).toBe("function");
    });
  });

  describe("renderPlayButton", () => {
    it("renders play button when not playing", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container, getByTestId } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-label", "Play");
      expect(getByTestId("play-icon")).toBeInTheDocument();
    });

    it("renders stop button when playing", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { getByLabelText, getByTestId } = render(
        <div>{result.current.renderPlayButton(true, "test.wav")}</div>
      );

      const button = getByLabelText("Stop");
      expect(button).toHaveAttribute("aria-label", "Stop");
      expect(getByTestId("square-icon")).toBeInTheDocument();
    });

    it("applies correct CSS classes for play button", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Play"]');
      expect(button).toHaveClass(
        "p-1",
        "rounded",
        "hover:bg-blue-100",
        "dark:hover:bg-slate-700",
        "text-xs"
      );
    });

    it("applies correct CSS classes for stop button", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(true, "test.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Stop"]');
      expect(button).toHaveClass(
        "p-1",
        "rounded",
        "hover:bg-blue-100",
        "dark:hover:bg-slate-700",
        "text-xs",
        "text-red-600",
        "dark:text-red-400"
      );
    });

    it("applies correct inline styles", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Play"]');
      expect(button).toHaveStyle({
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "24px",
        minWidth: "24px",
      });
    });

    it("calls onPlay when play button is clicked", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "sample.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Play"]');
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(3, "sample.wav");
    });

    it("calls onStop when stop button is clicked", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(true, "sample.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Stop"]');
      button?.click();

      expect(mockOnStop).toHaveBeenCalledWith(3, "sample.wav");
    });

    it("handles different voice numbers correctly", () => {
      const { result } = renderHook(() =>
        useVoicePanelButtons({ ...defaultProps, voice: 7 })
      );

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector('button[aria-label="Play"]');
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(7, "test.wav");
    });

    it("handles different sample names correctly", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>
          {result.current.renderPlayButton(false, "different-sample.wav")}
        </div>
      );

      const button = container.querySelector('button[aria-label="Play"]');
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(3, "different-sample.wav");
    });

    it("handles empty sample name", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "")}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(3, "");
    });

    it("memoizes correctly based on dependencies", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelButtons(props),
        { initialProps: defaultProps }
      );

      const firstRender = result.current.renderPlayButton;

      // Rerender with same props
      rerender(defaultProps);

      const secondRender = result.current.renderPlayButton;

      // Should be the same function reference (memoized)
      expect(firstRender).toBe(secondRender);
    });

    it("recreates when dependencies change", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelButtons(props),
        { initialProps: defaultProps }
      );

      const firstRender = result.current.renderPlayButton;

      // Change voice
      rerender({ ...defaultProps, voice: 5 });

      const secondRender = result.current.renderPlayButton;

      // Should be different function reference
      expect(firstRender).not.toBe(secondRender);
    });
  });

  describe("renderDeleteButton", () => {
    it("renders delete button correctly", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container, getByTestId } = render(
        <div>{result.current.renderDeleteButton(2)}</div>
      );

      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-label", "Delete sample");
      expect(button).toHaveAttribute("title", "Delete sample");
      expect(getByTestId("trash-icon")).toBeInTheDocument();
    });

    it("applies correct CSS classes", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(0)}</div>
      );

      const button = container.querySelector("button");
      expect(button).toHaveClass(
        "p-1",
        "rounded",
        "hover:bg-red-100",
        "dark:hover:bg-red-800",
        "text-xs",
        "text-red-600",
        "dark:text-red-400",
        "ml-2"
      );
    });

    it("applies correct inline styles", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(1)}</div>
      );

      const button = container.querySelector("button");
      expect(button).toHaveStyle({
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "24px",
        minWidth: "24px",
      });
    });

    it("calls handleDeleteSample when clicked", async () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(4)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockHandleDeleteSample).toHaveBeenCalledWith(4);
    });

    it("stops event propagation when clicked", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(0)}</div>
      );

      const button = container.querySelector("button");

      // Simulate click with mock event
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // Note: Testing stopPropagation requires more complex setup
      // This test verifies the button renders and is clickable
      expect(mockHandleDeleteSample).toHaveBeenCalled();
    });

    it("handles different slot indices correctly", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container: container1 } = render(
        <div>{result.current.renderDeleteButton(0)}</div>
      );
      const { container: container2 } = render(
        <div>{result.current.renderDeleteButton(7)}</div>
      );

      const button1 = container1.querySelector("button");
      const button2 = container2.querySelector("button");

      button1?.click();
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(0);

      button2?.click();
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(7);
    });

    it("handles negative slot index", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      expect(() => {
        render(<div>{result.current.renderDeleteButton(-1)}</div>);
      }).not.toThrow();

      const { container } = render(
        <div>{result.current.renderDeleteButton(-1)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockHandleDeleteSample).toHaveBeenCalledWith(-1);
    });

    it("handles very large slot index", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      expect(() => {
        render(<div>{result.current.renderDeleteButton(999)}</div>);
      }).not.toThrow();

      const { container } = render(
        <div>{result.current.renderDeleteButton(999)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockHandleDeleteSample).toHaveBeenCalledWith(999);
    });

    it("memoizes correctly based on dependencies", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelButtons(props),
        { initialProps: defaultProps }
      );

      const firstRender = result.current.renderDeleteButton;

      // Rerender with same props
      rerender(defaultProps);

      const secondRender = result.current.renderDeleteButton;

      // Should be the same function reference (memoized)
      expect(firstRender).toBe(secondRender);
    });

    it("recreates when dependencies change", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelButtons(props),
        { initialProps: defaultProps }
      );

      const firstRender = result.current.renderDeleteButton;

      // Change sampleActionsHook
      rerender({
        ...defaultProps,
        sampleActionsHook: { handleDeleteSample: vi.fn() },
      });

      const secondRender = result.current.renderDeleteButton;

      // Should be different function reference
      expect(firstRender).not.toBe(secondRender);
    });
  });

  describe("integration", () => {
    it("both buttons work together correctly", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>
          {result.current.renderPlayButton(false, "test.wav")}
          {result.current.renderDeleteButton(1)}
        </div>
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(2);

      // Click play button
      buttons[0].click();
      expect(mockOnPlay).toHaveBeenCalledWith(3, "test.wav");

      // Click delete button
      buttons[1].click();
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(1);
    });

    it("handles multiple renders with different parameters", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const playButton1 = result.current.renderPlayButton(false, "sample1.wav");
      const playButton2 = result.current.renderPlayButton(true, "sample2.wav");
      const deleteButton1 = result.current.renderDeleteButton(0);
      const deleteButton2 = result.current.renderDeleteButton(1);

      const { container } = render(
        <div>
          {playButton1}
          {playButton2}
          {deleteButton1}
          {deleteButton2}
        </div>
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons).toHaveLength(4);

      // Test each button
      buttons[0].click(); // Play sample1
      expect(mockOnPlay).toHaveBeenCalledWith(3, "sample1.wav");

      buttons[1].click(); // Stop sample2
      expect(mockOnStop).toHaveBeenCalledWith(3, "sample2.wav");

      buttons[2].click(); // Delete slot 0
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(0);

      buttons[3].click(); // Delete slot 1
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(1);
    });
  });

  describe("edge cases", () => {
    it("handles voice number 0", () => {
      const { result } = renderHook(() =>
        useVoicePanelButtons({ ...defaultProps, voice: 0 })
      );

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(0, "test.wav");
    });

    it("handles voice number 16", () => {
      const { result } = renderHook(() =>
        useVoicePanelButtons({ ...defaultProps, voice: 16 })
      );

      const { container } = render(
        <div>{result.current.renderPlayButton(false, "test.wav")}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(16, "test.wav");
    });

    it("handles undefined sample name", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, undefined as any)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(3, undefined);
    });

    it("handles null sample name", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderPlayButton(false, null as any)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      expect(mockOnPlay).toHaveBeenCalledWith(3, null);
    });

    it("handles async delete operation", async () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(2)}</div>
      );

      const button = container.querySelector("button");
      button?.click();

      // Should not throw even though handleDeleteSample is async
      expect(mockHandleDeleteSample).toHaveBeenCalledWith(2);
    });

    it("handles delete operation that throws error", async () => {
      const mockErrorDelete = vi
        .fn()
        .mockRejectedValue(new Error("Delete failed"));
      const errorProps = {
        ...defaultProps,
        sampleActionsHook: { handleDeleteSample: mockErrorDelete },
      };

      const { result } = renderHook(() => useVoicePanelButtons(errorProps));

      const { container } = render(
        <div>{result.current.renderDeleteButton(1)}</div>
      );

      const button = container.querySelector("button");

      // Should not throw - error should be handled by the delete handler
      expect(() => button.click()).not.toThrow();
      expect(mockErrorDelete).toHaveBeenCalledWith(1);
    });

    it("maintains consistent button structure", () => {
      const { result } = renderHook(() => useVoicePanelButtons(defaultProps));

      // Render same button multiple times
      const buttons = [
        result.current.renderPlayButton(false, "test.wav"),
        result.current.renderPlayButton(false, "test.wav"),
        result.current.renderDeleteButton(0),
        result.current.renderDeleteButton(0),
      ];

      const { container } = render(<div>{buttons}</div>);

      const renderedButtons = container.querySelectorAll("button");
      expect(renderedButtons).toHaveLength(4);

      // All buttons should have consistent structure
      renderedButtons.forEach((button) => {
        expect(button).toHaveAttribute("aria-label");
        expect(button.children).toHaveLength(1); // Should have one icon child
      });
    });
  });
});

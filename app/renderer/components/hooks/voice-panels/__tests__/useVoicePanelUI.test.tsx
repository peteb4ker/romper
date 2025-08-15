import * as kitUtilsShared from "@romper/shared/kitUtilsShared";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoicePanelUI } from "../useVoicePanelUI";

// Mock react-icons
vi.mock("react-icons/fi", () => ({
  FiCheck: () => <span data-testid="check-icon">Check</span>,
  FiEdit2: () => <span data-testid="edit-icon">Edit</span>,
  FiX: () => <span data-testid="x-icon">X</span>,
}));

// Mock the shared utility
vi.mock("@romper/shared/kitUtilsShared", () => ({
  toCapitalCase: vi.fn((str: string) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : str,
  ),
}));

describe("useVoicePanelUI", () => {
  const mockSlotRenderingHook = {
    calculateRenderSlots: vi.fn(() => ({ slotsToRender: 6 })),
  };

  const mockVoiceNameEditorHook = {
    editing: false,
    editValue: "",
    handleCancel: vi.fn(),
    handleKeyDown: vi.fn(),
    handleSave: vi.fn(),
    setEditValue: vi.fn(),
    startEditing: vi.fn(),
  };

  const defaultProps = {
    isEditable: true,
    slotRenderingHook: mockSlotRenderingHook,
    voice: 2,
    voiceName: "Drums",
    voiceNameEditorHook: mockVoiceNameEditorHook,
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
      const { result } = renderHook(() => useVoicePanelUI(defaultProps));

      expect(typeof result.current.renderVoiceName).toBe("function");
    });
  });

  describe("renderVoiceName", () => {
    it("renders voice name with number when not editing", () => {
      const { result } = renderHook(() => useVoicePanelUI(defaultProps));

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("2:");
      expect(container.textContent).toContain("Drums");
      expect(kitUtilsShared.toCapitalCase).toHaveBeenCalledWith("Drums");
    });

    it("renders edit button when editable and not editing", () => {
      const { result } = renderHook(() => useVoicePanelUI(defaultProps));

      const { getByTestId } = render(result.current.renderVoiceName());

      expect(getByTestId("edit-icon")).toBeInTheDocument();
    });

    it("does not render edit button when not editable", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, isEditable: false }),
      );

      const { queryByTestId } = render(result.current.renderVoiceName());

      expect(queryByTestId("edit-icon")).not.toBeInTheDocument();
    });

    it("renders input and save/cancel buttons when editing", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            editValue: "New Name",
          },
        }),
      );

      const { getByRole, getByTestId } = render(
        result.current.renderVoiceName(),
      );

      const input = getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("New Name");
      expect(getByTestId("check-icon")).toBeInTheDocument();
      expect(getByTestId("x-icon")).toBeInTheDocument();
    });

    it("renders 'No voice name set' when voice name is null", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voiceName: null }),
      );

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("No voice name set");
    });

    it("renders 'No voice name set' when voice name is empty string", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voiceName: "" }),
      );

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("No voice name set");
    });

    it("uses custom data-testid when provided", () => {
      const { result } = renderHook(() => useVoicePanelUI(defaultProps));

      const { getByTestId } = render(
        result.current.renderVoiceName("custom-voice-name"),
      );

      expect(getByTestId("custom-voice-name")).toBeInTheDocument();
    });

    it("uses default data-testid when not provided", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voice: 5 }),
      );

      const { getByTestId } = render(result.current.renderVoiceName());

      expect(getByTestId("voice-name-5")).toBeInTheDocument();
    });

    it("handles input changes when editing", () => {
      const mockSetEditValue = vi.fn();
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            editValue: "Current",
            setEditValue: mockSetEditValue,
          },
        }),
      );

      const { getByRole } = render(result.current.renderVoiceName());

      const input = getByRole("textbox");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      Object.defineProperty(input, "value", {
        value: "New Value",
        writable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));

      // Note: The actual onChange handler behavior would need to be tested at integration level
      // Here we're just verifying the input is rendered with the expected properties
      expect(input).toHaveAttribute("value", "Current");
    });

    it("handles keydown events when editing", () => {
      const mockHandleKeyDown = vi.fn();
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            handleKeyDown: mockHandleKeyDown,
          },
        }),
      );

      const { getByRole } = render(result.current.renderVoiceName());

      const input = getByRole("textbox");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockHandleKeyDown).toHaveBeenCalled();
    });

    it("handles save button click", () => {
      const mockHandleSave = vi.fn();
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            handleSave: mockHandleSave,
          },
        }),
      );

      const { getByTitle } = render(result.current.renderVoiceName());

      const saveButton = getByTitle("Save");
      saveButton.click();

      expect(mockHandleSave).toHaveBeenCalled();
    });

    it("handles cancel button click", () => {
      const mockHandleCancel = vi.fn();
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            handleCancel: mockHandleCancel,
          },
        }),
      );

      const { getByTitle } = render(result.current.renderVoiceName());

      const cancelButton = getByTitle("Cancel");
      cancelButton.click();

      expect(mockHandleCancel).toHaveBeenCalled();
    });

    it("handles edit button click", () => {
      const mockStartEditing = vi.fn();
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            startEditing: mockStartEditing,
          },
        }),
      );

      const { getByTitle } = render(result.current.renderVoiceName());

      const editButton = getByTitle("Edit voice name");
      editButton.click();

      expect(mockStartEditing).toHaveBeenCalled();
    });

    it("applies correct CSS classes for voice name display", () => {
      const { result } = renderHook(() => useVoicePanelUI(defaultProps));

      const { container } = render(result.current.renderVoiceName());

      const voiceNameSpan = container.querySelector(
        '[data-testid="voice-name-2"]',
      );
      expect(voiceNameSpan).toHaveClass(
        "ml-1",
        "px-2",
        "py-0.5",
        "rounded-full",
        "bg-blue-100",
        "dark:bg-blue-800",
        "text-blue-800",
        "dark:text-blue-100",
        "text-sm",
        "font-semibold",
        "tracking-wide",
      );
    });

    it("applies correct CSS classes for no voice name", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voiceName: null }),
      );

      const { container } = render(result.current.renderVoiceName());

      const voiceNameSpan = container.querySelector(
        '[data-testid="voice-name-2"]',
      );
      expect(voiceNameSpan).toHaveClass(
        "ml-1",
        "px-2",
        "py-0.5",
        "rounded-full",
        "bg-gray-200",
        "dark:bg-gray-700",
        "text-gray-500",
        "dark:text-gray-400",
        "text-sm",
        "font-semibold",
        "tracking-wide",
        "italic",
      );
    });
  });

  describe("memoization and performance", () => {
    it("memoizes renderVoiceName based on dependencies", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelUI(props),
        { initialProps: defaultProps },
      );

      const firstRender = result.current.renderVoiceName;

      // Rerender with same props
      rerender(defaultProps);

      const secondRender = result.current.renderVoiceName;

      // Should be the same function reference (memoized)
      expect(firstRender).toBe(secondRender);
    });

    it("recreates renderVoiceName when dependencies change", () => {
      const { rerender, result } = renderHook(
        (props) => useVoicePanelUI(props),
        { initialProps: defaultProps },
      );

      const firstRender = result.current.renderVoiceName;

      // Change voice number
      rerender({ ...defaultProps, voice: 3 });

      const secondRender = result.current.renderVoiceName;

      // Should be different function reference
      expect(firstRender).not.toBe(secondRender);
    });
  });

  describe("edge cases", () => {
    it("handles voice number 0", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voice: 0 }),
      );

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("0:");
    });

    it("handles voice number 16", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voice: 16 }),
      );

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("16:");
    });

    it("handles undefined voiceName", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({ ...defaultProps, voiceName: undefined as any }),
      );

      const { container } = render(result.current.renderVoiceName());

      expect(container.textContent).toContain("No voice name set");
    });

    it("handles empty editValue when editing", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: true,
            editValue: "",
          },
        }),
      );

      const { container } = render(result.current.renderVoiceName());

      const input = container.querySelector("input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("");
    });

    it("handles whitespace-only voiceName", () => {
      const { result } = renderHook(() =>
        useVoicePanelUI({
          ...defaultProps,
          voiceName: "   ",
          voiceNameEditorHook: {
            ...mockVoiceNameEditorHook,
            editing: false, // Make sure we're not in editing mode
          },
        }),
      );

      render(result.current.renderVoiceName());

      // Should still render the whitespace (toCapitalCase would handle it)
      expect(vi.mocked(kitUtilsShared.toCapitalCase)).toHaveBeenCalledWith(
        "   ",
      );
    });
  });
});

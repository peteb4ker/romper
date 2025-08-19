import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVoiceNameEditor } from "../useVoiceNameEditor";

describe("useVoiceNameEditor", () => {
  const defaultProps = {
    onSaveVoiceName: vi.fn(),
    voice: 1,
    voiceName: "Test Voice",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    defaultProps.onSaveVoiceName = vi.fn();
  });

  it("initializes with correct default values", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    expect(result.current.editing).toBe(false);
    expect(result.current.editValue).toBe("Test Voice");
  });

  it("handles null voice name", () => {
    const { result } = renderHook(() =>
      useVoiceNameEditor({ ...defaultProps, voiceName: null })
    );

    expect(result.current.editValue).toBe("");
  });

  it("starts editing when startEditing is called", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.editing).toBe(true);
  });

  it("updates edit value", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.setEditValue("New Voice Name");
    });

    expect(result.current.editValue).toBe("New Voice Name");
  });

  it("saves voice name and exits editing mode", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
    });

    act(() => {
      result.current.setEditValue("New Voice Name");
    });

    act(() => {
      result.current.handleSave();
    });

    expect(defaultProps.onSaveVoiceName).toHaveBeenCalledWith(
      1,
      "New Voice Name"
    );
    expect(result.current.editing).toBe(false);
  });

  it("trims whitespace when saving", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
    });

    act(() => {
      result.current.setEditValue("  Trimmed Voice  ");
    });

    act(() => {
      result.current.handleSave();
    });

    expect(defaultProps.onSaveVoiceName).toHaveBeenCalledWith(
      1,
      "Trimmed Voice"
    );
  });

  it("cancels editing and restores original value", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
      result.current.setEditValue("Changed Value");
      result.current.handleCancel();
    });

    expect(defaultProps.onSaveVoiceName).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
    expect(result.current.editValue).toBe("Test Voice");
  });

  it("handles Enter key to save", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
      result.current.setEditValue("Enter Save Test");
    });

    const mockEvent = {
      key: "Enter",
    } as React.KeyboardEvent<HTMLInputElement>;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    expect(defaultProps.onSaveVoiceName).toHaveBeenCalledWith(
      1,
      "Enter Save Test"
    );
    expect(result.current.editing).toBe(false);
  });

  it("handles Escape key to cancel", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
      result.current.setEditValue("Escape Cancel Test");
    });

    const mockEvent = {
      key: "Escape",
    } as React.KeyboardEvent<HTMLInputElement>;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    expect(defaultProps.onSaveVoiceName).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
    expect(result.current.editValue).toBe("Test Voice");
  });

  it("ignores other keys", () => {
    const { result } = renderHook(() => useVoiceNameEditor(defaultProps));

    act(() => {
      result.current.startEditing();
      result.current.setEditValue("Other Key Test");
    });

    const mockEvent = {
      key: "a",
    } as React.KeyboardEvent<HTMLInputElement>;

    act(() => {
      result.current.handleKeyDown(mockEvent);
    });

    expect(defaultProps.onSaveVoiceName).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
    expect(result.current.editValue).toBe("Other Key Test");
  });

  it("updates edit value when voice name prop changes", () => {
    const { rerender, result } = renderHook(
      ({ voiceName }) => useVoiceNameEditor({ ...defaultProps, voiceName }),
      { initialProps: { voiceName: "Initial Voice" } }
    );

    expect(result.current.editValue).toBe("Initial Voice");

    rerender({ voiceName: "Updated Voice" });

    expect(result.current.editValue).toBe("Updated Voice");
  });
});

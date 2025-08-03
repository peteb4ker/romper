// Test suite for KitHeader component
import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Kit } from "../../../../shared/db/schema";

import KitHeader from "../KitHeader";

afterEach(() => {
  cleanup();
});

describe("KitHeader", () => {
  const baseProps = {
    editingKitAlias: false,
    handleSaveKitAlias: vi.fn(),
    isEditable: false,
    kit: { alias: "My Kit" } as Kit,
    kitAliasInput: "My Kit",
    kitAliasInputRef: { current: null },
    kitIndex: 1,
    kitName: "A1",
    kits: ["A1", "A2", "A3"],
    onBack: vi.fn(),
    onCreateKit: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onScanKit: vi.fn(),
    onToggleEditableMode: vi.fn(),
    setEditingKitAlias: vi.fn(),
    setKitAliasInput: vi.fn(),
  };

  it("renders kit name and label", () => {
    render(<KitHeader {...baseProps} />);
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("My Kit")).toBeInTheDocument();
  });

  it("calls setEditingKitAlias(true) when alias is clicked", () => {
    const setEditingKitAlias = vi.fn();
    render(
      <KitHeader {...baseProps} setEditingKitAlias={setEditingKitAlias} />,
    );
    fireEvent.click(screen.getByText("My Kit"));
    expect(setEditingKitAlias).toHaveBeenCalledWith(true);
  });

  it("calls onScanKit when Scan Kit button is clicked", () => {
    const onScanKit = vi.fn();
    render(<KitHeader {...baseProps} onScanKit={onScanKit} />);

    fireEvent.click(screen.getByText("Scan Kit"));
    expect(onScanKit).toHaveBeenCalled();
  });

  it("shows input when editingKitAlias is true and handles input events", () => {
    const setEditingKitAlias = vi.fn();
    const setKitAliasInput = vi.fn();
    const handleSaveKitAlias = vi.fn();
    render(
      <KitHeader
        {...baseProps}
        editingKitAlias={true}
        handleSaveKitAlias={handleSaveKitAlias}
        kitAliasInput="Edit Alias"
        setEditingKitAlias={setEditingKitAlias}
        setKitAliasInput={setKitAliasInput}
      />,
    );
    const input = screen.getByDisplayValue("Edit Alias");
    fireEvent.change(input, { target: { value: "New Alias" } });
    expect(setKitAliasInput).toHaveBeenCalledWith("New Alias");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(setEditingKitAlias).toHaveBeenCalledWith(false);
    expect(handleSaveKitAlias).toHaveBeenCalledWith("Edit Alias");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setEditingKitAlias).toHaveBeenCalledWith(false);
    expect(setKitAliasInput).toHaveBeenCalledWith("My Kit");
    fireEvent.blur(input);
    expect(setEditingKitAlias).toHaveBeenCalledWith(false);
    expect(handleSaveKitAlias).toHaveBeenCalledWith("Edit Alias");
  });

  it("calls onBack when Back button is clicked", () => {
    const onBack = vi.fn();
    render(<KitHeader {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByTitle("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onPrevKit and disables at first kit", () => {
    const onPrevKit = vi.fn();
    render(<KitHeader {...baseProps} kitIndex={0} onPrevKit={onPrevKit} />);
    const prevBtn = screen.getByTitle("Previous Kit");
    expect(prevBtn).toBeDisabled();
    fireEvent.click(prevBtn);
    expect(onPrevKit).not.toHaveBeenCalled();
  });

  it("calls onNextKit and disables at last kit", () => {
    const onNextKit = vi.fn();
    render(<KitHeader {...baseProps} kitIndex={2} onNextKit={onNextKit} />);
    const nextBtn = screen.getByTitle("Next Kit");
    expect(nextBtn).toBeDisabled();
    fireEvent.click(nextBtn);
    expect(onNextKit).not.toHaveBeenCalled();
  });

  it("calls onScanKit when Scan Kit button is clicked", () => {
    const onScanKit = vi.fn();
    render(<KitHeader {...baseProps} onScanKit={onScanKit} />);
    fireEvent.click(screen.getByText("Scan Kit"));
    expect(onScanKit).toHaveBeenCalled();
  });

  it("shows (no name) if kit.alias is empty", () => {
    render(<KitHeader {...baseProps} kit={{ alias: "" } as Kit} />);
    expect(screen.getByText("(no name)")).toBeInTheDocument();
  });

  describe("Editable Mode Toggle - Task 5.1", () => {
    it("shows editable mode toggle when onToggleEditableMode is provided", () => {
      render(<KitHeader {...baseProps} onToggleEditableMode={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: /enable editable mode/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Locked")).toBeInTheDocument();
      expect(screen.getByTitle("Enable editable mode")).toBeInTheDocument();
    });

    it("shows correct visual state when editable mode is off", () => {
      render(
        <KitHeader
          {...baseProps}
          isEditable={false}
          onToggleEditableMode={vi.fn()}
        />,
      );

      expect(screen.getByText("Locked")).toBeInTheDocument();
      // The toggle switch should be in the "off" position (gray background)
      const toggleButton = screen.getByRole("button", {
        name: /enable editable mode/i,
      });
      expect(toggleButton).toHaveClass("bg-gray-300");
    });

    it("shows correct visual state when editable mode is on", () => {
      render(
        <KitHeader
          {...baseProps}
          isEditable={true}
          onToggleEditableMode={vi.fn()}
        />,
      );

      expect(screen.getByText("Editable")).toBeInTheDocument();
      // The toggle switch should be in the "on" position (orange background)
      const toggleButton = screen.getByRole("button", {
        name: /disable editable mode/i,
      });
      expect(toggleButton).toHaveClass("bg-orange-500");
    });

    it("calls onToggleEditableMode when toggle button is clicked", () => {
      const onToggleEditableMode = vi.fn();
      render(
        <KitHeader
          {...baseProps}
          isEditable={false}
          onToggleEditableMode={onToggleEditableMode}
        />,
      );

      const toggleButton = screen.getByRole("button", {
        name: /enable editable mode/i,
      });
      fireEvent.click(toggleButton);

      expect(onToggleEditableMode).toHaveBeenCalledOnce();
    });

    it("does not show editable mode toggle when onToggleEditableMode is not provided", () => {
      render(<KitHeader {...baseProps} onToggleEditableMode={undefined} />);

      expect(screen.queryByText("Locked")).not.toBeInTheDocument();
      expect(screen.queryByText("Editable")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /editable mode/i }),
      ).not.toBeInTheDocument();
    });

    it("toggle button has correct accessibility attributes", () => {
      render(
        <KitHeader
          {...baseProps}
          isEditable={false}
          onToggleEditableMode={vi.fn()}
        />,
      );

      const toggleButton = screen.getByRole("button", {
        name: /enable editable mode/i,
      });
      expect(toggleButton).toHaveAttribute("title", "Enable editable mode");

      // Check for screen reader text
      expect(screen.getByText("Enable editable mode")).toHaveClass("sr-only");
    });

    it("toggle button title changes based on editable state", () => {
      const { rerender } = render(
        <KitHeader
          {...baseProps}
          isEditable={false}
          onToggleEditableMode={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Enable editable mode")).toBeInTheDocument();

      rerender(
        <KitHeader
          {...baseProps}
          isEditable={true}
          onToggleEditableMode={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Disable editable mode")).toBeInTheDocument();
    });
  });
});

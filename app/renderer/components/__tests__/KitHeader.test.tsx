// Test suite for KitHeader component
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

import KitHeader from "../KitHeader";
import type { RampleKitLabel } from "../kitTypes";

afterEach(() => {
  cleanup();
});

describe("KitHeader", () => {
  const baseProps = {
    kitName: "A1",
    kitLabel: { label: "My Kit" } as RampleKitLabel,
    editingKitLabel: false,
    setEditingKitLabel: vi.fn(),
    kitLabelInput: "My Kit",
    setKitLabelInput: vi.fn(),
    handleSaveKitLabel: vi.fn(),
    kitLabelInputRef: { current: null },
    onBack: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onCreateKit: vi.fn(),
    onRescanAllVoiceNames: vi.fn(),
    onScanKit: vi.fn(),
    kits: ["A1", "A2", "A3"],
    kitIndex: 1,
  };

  it("renders kit name and label", () => {
    render(<KitHeader {...baseProps} />);
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("My Kit")).toBeInTheDocument();
  });

  it("calls setEditingKitLabel(true) when label is clicked", () => {
    const setEditingKitLabel = vi.fn();
    render(
      <KitHeader {...baseProps} setEditingKitLabel={setEditingKitLabel} />,
    );
    fireEvent.click(screen.getByText("My Kit"));
    expect(setEditingKitLabel).toHaveBeenCalledWith(true);
  });

  it("calls onScanKit when Scan Kit button is clicked", () => {
    const onScanKit = vi.fn();
    render(<KitHeader {...baseProps} onScanKit={onScanKit} />);

    fireEvent.click(screen.getByText("Scan Kit"));
    expect(onScanKit).toHaveBeenCalled();
  });

  it("shows input when editingKitLabel is true and handles input events", () => {
    const setEditingKitLabel = vi.fn();
    const setKitLabelInput = vi.fn();
    const handleSaveKitLabel = vi.fn();
    render(
      <KitHeader
        {...baseProps}
        editingKitLabel={true}
        setEditingKitLabel={setEditingKitLabel}
        setKitLabelInput={setKitLabelInput}
        handleSaveKitLabel={handleSaveKitLabel}
        kitLabelInput="Edit Label"
      />,
    );
    const input = screen.getByDisplayValue("Edit Label");
    fireEvent.change(input, { target: { value: "New Label" } });
    expect(setKitLabelInput).toHaveBeenCalledWith("New Label");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(setEditingKitLabel).toHaveBeenCalledWith(false);
    expect(handleSaveKitLabel).toHaveBeenCalledWith("Edit Label");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setEditingKitLabel).toHaveBeenCalledWith(false);
    expect(setKitLabelInput).toHaveBeenCalledWith("My Kit");
    fireEvent.blur(input);
    expect(setEditingKitLabel).toHaveBeenCalledWith(false);
    expect(handleSaveKitLabel).toHaveBeenCalledWith("Edit Label");
  });

  it("calls onBack when Back button is clicked", () => {
    const onBack = vi.fn();
    render(<KitHeader {...baseProps} onBack={onBack} />);
    fireEvent.click(screen.getByTitle("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls onPrevKit and disables at first kit", () => {
    const onPrevKit = vi.fn();
    render(<KitHeader {...baseProps} onPrevKit={onPrevKit} kitIndex={0} />);
    const prevBtn = screen.getByTitle("Previous Kit");
    expect(prevBtn).toBeDisabled();
    fireEvent.click(prevBtn);
    expect(onPrevKit).not.toHaveBeenCalled();
  });

  it("calls onNextKit and disables at last kit", () => {
    const onNextKit = vi.fn();
    render(<KitHeader {...baseProps} onNextKit={onNextKit} kitIndex={2} />);
    const nextBtn = screen.getByTitle("Next Kit");
    expect(nextBtn).toBeDisabled();
    fireEvent.click(nextBtn);
    expect(onNextKit).not.toHaveBeenCalled();
  });

  it("calls onRescanAllVoiceNames when Rescan Kit Voice Names is clicked", () => {
    const onRescanAllVoiceNames = vi.fn();
    render(
      <KitHeader
        {...baseProps}
        onRescanAllVoiceNames={onRescanAllVoiceNames}
      />,
    );
    fireEvent.click(screen.getByText("Rescan Kit Voice Names"));
    expect(onRescanAllVoiceNames).toHaveBeenCalled();
  });

  it("shows (no name) if kitLabel.label is empty", () => {
    render(
      <KitHeader {...baseProps} kitLabel={{ label: "" } as RampleKitLabel} />,
    );
    expect(screen.getByText("(no name)")).toBeInTheDocument();
  });
});

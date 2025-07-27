// Test suite for KitHeader component
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

import type { Kit } from "../../../../shared/db/schema";
import KitHeader from "../KitHeader";

afterEach(() => {
  cleanup();
});

describe("KitHeader", () => {
  const baseProps = {
    kitName: "A1",
    kit: { alias: "My Kit" } as Kit,
    editingKitAlias: false,
    setEditingKitAlias: vi.fn(),
    kitAliasInput: "My Kit",
    setKitAliasInput: vi.fn(),
    handleSaveKitAlias: vi.fn(),
    kitAliasInputRef: { current: null },
    onBack: vi.fn(),
    onNextKit: vi.fn(),
    onPrevKit: vi.fn(),
    onCreateKit: vi.fn(),
    onScanKit: vi.fn(),
    onToggleEditableMode: vi.fn(),
    isEditable: false,
    kits: ["A1", "A2", "A3"],
    kitIndex: 1,
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
        setEditingKitAlias={setEditingKitAlias}
        setKitAliasInput={setKitAliasInput}
        handleSaveKitAlias={handleSaveKitAlias}
        kitAliasInput="Edit Alias"
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
});

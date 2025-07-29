// Test suite for KitBankNav component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../tests/factories/kit.factory";
import KitBankNav from "../KitBankNav";

describe("KitBankNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all 26 bank buttons", () => {
    render(<KitBankNav kits={[]} onBankClick={() => {}} />);
    for (let i = 0; i < 26; i++) {
      const bank = String.fromCharCode(65 + i);
      const buttons = screen.queryAllByText(bank);
      expect(buttons.length).toBeGreaterThan(0);
    }
  });

  it("disables banks with no kits", () => {
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
      createMockKitWithRelations({ name: "B2", bank_letter: "B" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);
    // Find all A buttons and check which is enabled/disabled
    const aButtons = screen.queryAllByText("A");
    const bButtons = screen.queryAllByText("B");
    const cButtons = screen.queryAllByText("C");
    const zButtons = screen.queryAllByText("Z");
    // At least one enabled for A and B, all disabled for C and Z
    expect(aButtons.some((btn) => !btn.disabled)).toBe(true);
    expect(bButtons.some((btn) => !btn.disabled)).toBe(true);
    expect(cButtons.every((btn) => btn.disabled)).toBe(true);
    expect(zButtons.every((btn) => btn.disabled)).toBe(true);
  });

  it("calls onBankClick when enabled bank is clicked", () => {
    const onBankClick = vi.fn();
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
      createMockKitWithRelations({ name: "B2", bank_letter: "B" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={onBankClick} />);

    // Use getAllByRole to handle multiple renders
    const aButtons = screen.getAllByRole("button", { name: "Jump to bank A" });
    const enabledButton = aButtons.find((button) => !button.disabled);

    expect(enabledButton).toBeDefined();
    expect(enabledButton?.disabled).toBe(false);

    fireEvent.click(enabledButton!);
    expect(onBankClick).toHaveBeenCalledWith("A");
  });

  it("does not call onBankClick when disabled bank is clicked", () => {
    const onBankClick = vi.fn();
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={onBankClick} />);
    // Use getAllByRole to match the correct button by accessible name
    const bButtons = screen.getAllByRole("button", { name: "Jump to bank B" });
    const disabledB = bButtons.find((btn) => btn.disabled);
    expect(disabledB).toBeDefined();
    fireEvent.click(disabledB);
    expect(onBankClick).not.toHaveBeenCalled();
  });

  it("shows bankNames as title if provided", () => {
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
    ];
    render(
      <KitBankNav
        kits={mockKits}
        onBankClick={() => {}}
        bankNames={{ A: "Alpha" }}
      />,
    );
    expect(screen.getByTitle("Alpha")).not.toBeNull();
  });
});

describe("A-Z hotkey navigation and bank highlighting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("highlights the correct bank when selectedBank is set", () => {
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
      createMockKitWithRelations({ name: "B2", bank_letter: "B" }),
    ];
    render(
      <KitBankNav kits={mockKits} onBankClick={() => {}} selectedBank="B" />,
    );
    const bButtons = screen.getAllByRole("button", { name: "Jump to bank B" });
    const selectedBButton = bButtons.find(
      (btn) => btn.getAttribute("aria-current") === "true",
    );
    expect(selectedBButton).toBeDefined();
    expect(selectedBButton!.className).toContain("bg-blue-800");
    expect(selectedBButton!.getAttribute("aria-current")).toBe("true");
  });

  it("all bank buttons are focusable and have visible focus ring", () => {
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);
    const aButtons = screen.getAllByRole("button", { name: "Jump to bank A" });
    const enabledAButton = aButtons.find((btn) => !btn.disabled);
    expect(enabledAButton).toBeDefined();
    enabledAButton!.focus();
    expect(document.activeElement).toBe(enabledAButton);
  });

  it("disabled banks are not clickable or focusable", () => {
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);
    const bButtons = screen.getAllByRole("button", { name: "Jump to bank B" });
    const disabledBButton = bButtons.find((btn) => btn.disabled);
    expect(disabledBButton).toBeDefined();
    expect(disabledBButton!.disabled).toBe(true);
  });

  it("calls onBankClick when enabled bank is clicked", () => {
    const onBankClick = vi.fn();
    const mockKits = [
      createMockKitWithRelations({ name: "A1", bank_letter: "A" }),
      createMockKitWithRelations({ name: "B2", bank_letter: "B" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={onBankClick} />);
    const aButtons = screen.getAllByRole("button", { name: "Jump to bank A" });
    const enabledAButton = aButtons.find((button) => !button.disabled);
    expect(enabledAButton).toBeDefined();
    fireEvent.click(enabledAButton!);
    expect(onBankClick).toHaveBeenCalledWith("A");
  });
});

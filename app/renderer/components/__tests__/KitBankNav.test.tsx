// Test suite for KitBankNav component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import KitBankNav from "../KitBankNav";

afterEach(() => {
  cleanup();
});

describe("KitBankNav", () => {
  it("renders all 26 bank buttons", () => {
    render(<KitBankNav kits={[]} onBankClick={() => {}} />);
    for (let i = 0; i < 26; i++) {
      const bank = String.fromCharCode(65 + i);
      const buttons = screen.queryAllByText(bank);
      expect(buttons.length).toBeGreaterThan(0);
    }
  });

  it("disables banks with no kits", () => {
    render(<KitBankNav kits={["A1", "B2"]} onBankClick={() => {}} />);
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
    render(<KitBankNav kits={["A1", "B2"]} onBankClick={onBankClick} />);
    const aButtons = screen.getAllByRole("button", { name: "Jump to bank A" });
    const enabledA = aButtons.find((btn) => !btn.disabled);

    expect(enabledA).toBeDefined();
    expect(enabledA?.disabled).toBe(false); // Debug: ensure it's enabled
    fireEvent.click(enabledA);
    expect(onBankClick).toHaveBeenCalledWith("A");
  });

  it("does not call onBankClick when disabled bank is clicked", () => {
    const onBankClick = vi.fn();
    render(<KitBankNav kits={["A1"]} onBankClick={onBankClick} />);
    // Use getAllByRole to match the correct button by accessible name
    const bButtons = screen.getAllByRole("button", { name: "Jump to bank B" });
    const disabledB = bButtons.find((btn) => btn.disabled);
    expect(disabledB).toBeDefined();
    fireEvent.click(disabledB);
    expect(onBankClick).not.toHaveBeenCalled();
  });

  it("shows bankNames as title if provided", () => {
    render(
      <KitBankNav
        kits={["A1"]}
        onBankClick={() => {}}
        bankNames={{ A: "Alpha" }}
      />,
    );
    expect(screen.getByTitle("Alpha")).not.toBeNull();
  });
});

describe("A-Z hotkey navigation and bank highlighting", () => {
  it("highlights the correct bank when selectedBank is set", () => {
    render(
      <KitBankNav
        kits={["A1", "B2"]}
        onBankClick={() => {}}
        selectedBank="B"
      />,
    );
    const bButton = screen.getByRole("button", { name: "Jump to bank B" });
    expect(bButton.className).toContain("bg-blue-800");
    expect(bButton.getAttribute("aria-current")).toBe("true");
  });

  it("all bank buttons are focusable and have visible focus ring", () => {
    render(<KitBankNav kits={["A1"]} onBankClick={() => {}} />);
    const aButton = screen.getByRole("button", { name: "Jump to bank A" });
    aButton.focus();
    expect(document.activeElement).toBe(aButton);
  });

  it("disabled banks are not clickable or focusable", () => {
    render(<KitBankNav kits={["A1"]} onBankClick={() => {}} />);
    const bButton = screen.getByRole("button", { name: "Jump to bank B" });
    expect(bButton.disabled).toBe(true);
  });

  it("calls onBankClick when enabled bank is clicked", () => {
    const onBankClick = vi.fn();
    render(<KitBankNav kits={["A1", "B2"]} onBankClick={onBankClick} />);
    const aButton = screen.getByRole("button", { name: "Jump to bank A" });
    fireEvent.click(aButton);
    expect(onBankClick).toHaveBeenCalledWith("A");
  });
});

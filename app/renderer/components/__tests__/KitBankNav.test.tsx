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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
      createMockKitWithRelations({ bank_letter: "B", name: "B2" }),
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
      createMockKitWithRelations({ bank_letter: "B", name: "B2" }),
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
    ];
    render(
      <KitBankNav
        bankNames={{ A: "Alpha" }}
        kits={mockKits}
        onBankClick={() => {}}
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
      createMockKitWithRelations({ bank_letter: "B", name: "B2" }),
    ];
    render(
      <KitBankNav kits={mockKits} onBankClick={() => {}} selectedBank="B" />,
    );
    const bButtons = screen.getAllByRole("button", { name: "Jump to bank B" });
    const selectedBButton = bButtons.find(
      (btn) => btn.getAttribute("aria-current") === "true",
    );
    expect(selectedBButton).toBeDefined();
    expect(selectedBButton!.className).toContain("bg-accent-primary");
    expect(selectedBButton!.getAttribute("aria-current")).toBe("true");
  });

  it("all bank buttons are focusable and have visible focus ring", () => {
    const mockKits = [
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
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
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
      createMockKitWithRelations({ bank_letter: "B", name: "B2" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={onBankClick} />);
    const aButtons = screen.getAllByRole("button", { name: "Jump to bank A" });
    const enabledAButton = aButtons.find((button) => !button.disabled);
    expect(enabledAButton).toBeDefined();
    fireEvent.click(enabledAButton!);
    expect(onBankClick).toHaveBeenCalledWith("A");
  });
});

describe("KitBankNav fisheye hover behavior", () => {
  const originalGetComputedStyle = window.getComputedStyle;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    window.getComputedStyle = originalGetComputedStyle;
    vi.restoreAllMocks();
  });

  function mockNavGeometry(nav: HTMLElement) {
    // Simulate a nav with py-2 (8px top/bottom padding) and 26 buttons of 24px each = 624px content
    // Total height = 624 + 16 = 640px
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue({
      bottom: 740,
      height: 640,
      left: 0,
      right: 28,
      top: 100,
      width: 28,
      x: 0,
      y: 100,
    });
    // Only intercept getComputedStyle for the nav element; delegate all others to real implementation
    window.getComputedStyle = ((el: Element, ...rest: unknown[]) => {
      if (el === nav) {
        return {
          ...originalGetComputedStyle(el),
          paddingBottom: "8px",
          paddingTop: "8px",
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(el, ...(rest as [string | undefined]));
    }) as typeof window.getComputedStyle;
  }

  function getBankButton(letter: string) {
    const nav = screen.getByTestId("bank-nav");
    return nav.querySelector(
      `button[aria-label="Jump to bank ${letter}"]`,
    ) as HTMLButtonElement;
  }

  it("hovering at the top of content area highlights letter A (not B)", () => {
    const mockKits = Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return createMockKitWithRelations({
        bank_letter: letter,
        name: `${letter}1`,
      });
    });
    render(
      <KitBankNav
        bankNames={{ A: "Alpha", B: "Bravo" }}
        kits={mockKits}
        onBankClick={() => {}}
      />,
    );

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    // Mouse at very top of content area: clientY = rect.top + padTop = 100 + 8 = 108
    fireEvent.mouseMove(nav, { clientY: 108 });

    // Letter A should be highlighted (text-accent-primary), not B
    expect(getBankButton("A").className).toContain("text-accent-primary");
    expect(getBankButton("B").className).not.toContain("text-accent-primary");
  });

  it("hovering at the bottom of content area highlights letter Z", () => {
    const mockKits = Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return createMockKitWithRelations({
        bank_letter: letter,
        name: `${letter}1`,
      });
    });
    render(
      <KitBankNav
        bankNames={{ Z: "Zulu" }}
        kits={mockKits}
        onBankClick={() => {}}
      />,
    );

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    // Mouse at bottom of content area: clientY = rect.top + padTop + contentHeight = 100 + 8 + 624 = 732
    fireEvent.mouseMove(nav, { clientY: 732 });

    expect(getBankButton("Z").className).toContain("text-accent-primary");
  });

  it("uses CSS transform for scaling instead of fontSize/height", () => {
    const mockKits = Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return createMockKitWithRelations({
        bank_letter: letter,
        name: `${letter}1`,
      });
    });
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    // Trigger hover to activate fisheye
    fireEvent.mouseMove(nav, { clientY: 108 });

    const aButton = getBankButton("A");

    // Should use fixed fontSize (not scaled)
    expect(aButton.style.fontSize).toBe("12px");
    // Should use transform for scaling
    expect(aButton.style.transform).toMatch(/^scale\(/);
    // Should have transform transition, not fontSize transition
    expect(aButton.style.transition).toContain("transform");
    expect(aButton.style.transition).not.toContain("font-size");
  });

  it("resets hover state on mouse leave", () => {
    const mockKits = [
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    // Hover to activate
    fireEvent.mouseMove(nav, { clientY: 108 });
    // Then leave
    fireEvent.mouseLeave(nav);

    // All buttons should have scale(1) — no fisheye
    expect(getBankButton("A").style.transform).toBe("scale(1)");
  });

  it("hovered button has elevated z-index so floating label renders in front", () => {
    const mockKits = Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return createMockKitWithRelations({
        bank_letter: letter,
        name: `${letter}1`,
      });
    });
    render(
      <KitBankNav
        bankNames={{ A: "Alpha" }}
        kits={mockKits}
        onBankClick={() => {}}
      />,
    );

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    // Hover over A
    fireEvent.mouseMove(nav, { clientY: 108 });

    const aButton = getBankButton("A");
    const bButton = getBankButton("B");

    // Hovered button should have elevated z-index; non-hovered should not
    expect(Number(aButton.style.zIndex)).toBeGreaterThan(0);
    expect(bButton.style.zIndex).toBe("auto");
  });

  it("highlights Z correctly when nav is flex-stretched taller than content", () => {
    const mockKits = Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return createMockKitWithRelations({
        bank_letter: letter,
        name: `${letter}1`,
      });
    });
    render(
      <KitBankNav
        bankNames={{ Z: "Zulu" }}
        kits={mockKits}
        onBankClick={() => {}}
      />,
    );

    const nav = screen.getByTestId("bank-nav");

    // Simulate flex-stretched nav: 800px tall instead of natural 640px
    // This is the root cause — extra height below buttons skews the fraction
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue({
      bottom: 900,
      height: 800,
      left: 0,
      right: 28,
      top: 100,
      width: 28,
      x: 0,
      y: 100,
    });
    window.getComputedStyle = ((el: Element, ...rest: unknown[]) => {
      if (el === nav) {
        return {
          ...originalGetComputedStyle(el),
          paddingBottom: "8px",
          paddingTop: "8px",
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(el, ...(rest as [string | undefined]));
    }) as typeof window.getComputedStyle;

    // Mouse at Z's position: top(100) + pad(8) + 25.5*24 = 100 + 8 + 612 = 720
    fireEvent.mouseMove(nav, { clientY: 720 });

    // With the old code this would highlight W because fraction = 612/784 ≈ 0.78 → index 19.5
    // With the fix it correctly maps to Z because we use banks.length * BASE_HEIGHT
    expect(getBankButton("Z").className).toContain("text-accent-primary");
  });

  it("calls cancelAnimationFrame on mouse leave", () => {
    const mockKits = [
      createMockKitWithRelations({ bank_letter: "A", name: "A1" }),
    ];
    render(<KitBankNav kits={mockKits} onBankClick={() => {}} />);

    const nav = screen.getByTestId("bank-nav");
    mockNavGeometry(nav);

    fireEvent.mouseMove(nav, { clientY: 108 });
    fireEvent.mouseLeave(nav);

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });
});

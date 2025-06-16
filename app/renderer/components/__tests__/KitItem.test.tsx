import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";

import KitItem from "../KitItem";

afterEach(() => {
  cleanup();
});

describe("KitItem", () => {
  const baseProps = {
    kit: "A1",
    colorClass: "",
    isValid: true,
    onSelect: vi.fn(),
    onDuplicate: vi.fn(),
    sampleCounts: [12, 12, 12, 12],
    kitLabel: {
      voiceNames: {
        1: "Loop",
        2: "Loop",
        3: "Kick",
        4: "Loop",
      },
    },
  };

  it("renders kit name and unique voice labels", () => {
    render(<KitItem {...baseProps} />);
    // Use getAllByText for possible duplicates, check at least one exists
    expect(screen.getAllByText("A1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Loop").length).toBe(1);
    expect(screen.getAllByText("Kick").length).toBe(1);
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<KitItem {...baseProps} onSelect={onSelect} />);
    // Click the KitItem root
    const kitRoot = screen.getByTestId("kit-item-A1");
    fireEvent.click(kitRoot);
    expect(onSelect).toHaveBeenCalled();
  });

  it("calls onDuplicate when duplicate button is clicked", () => {
    const onDuplicate = vi.fn();
    render(<KitItem {...baseProps} onDuplicate={onDuplicate} />);
    // Click the first duplicate button
    const kitRoot = screen.getByTestId("kit-item-A1");
    const dupBtn = kitRoot.querySelector('button[title="Duplicate kit"]');
    fireEvent.click(dupBtn!);
    expect(onDuplicate).toHaveBeenCalled();
  });

  it("shows invalid style if isValid is false", () => {
    render(<KitItem {...baseProps} isValid={false} />);
    // At least one kit name span should have the invalid class
    const kitNameEls = screen.getAllByText("A1");
    expect(
      kitNameEls.some((el) => el.className.includes("text-red")),
    ).toBeTruthy();
  });

  it("renders sample counts for each voice", () => {
    render(<KitItem {...baseProps} sampleCounts={[1, 2, 3, 4]} />);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });
});

describe("KitItem voice label deduplication", () => {
  it("renders each voice label only once (array)", () => {
    const kitLabel = { voiceNames: ["vox", "vox", "synth", "synth", "fx"] };
    render(
      <KitItem
        kit="Test Kit"
        colorClass=""
        isValid={true}
        onSelect={() => {}}
        onDuplicate={() => {}}
        sampleCounts={[12, 12, 12, 12]}
        kitLabel={kitLabel}
      />,
    );
    // Always select the correct KitItem root to avoid confusion if multiple are rendered
    const kitRoot = screen.getByTestId("kit-item-Test Kit");
    // Query only within this KitItem for deduped, capitalized labels
    const getLabel = (label) => {
      return Array.from(kitRoot.querySelectorAll("span")).filter(
        (el) => el.textContent === label,
      );
    };
    expect(getLabel("Vox").length).toBe(1);
    expect(getLabel("Synth").length).toBe(1);
    expect(getLabel("FX").length).toBe(1);
    // Ensure no duplicate deduped labels
    expect(kitRoot.textContent?.match(/Vox/g)?.length || 0).toBe(1);
    expect(kitRoot.textContent?.match(/Synth/g)?.length || 0).toBe(1);
    expect(kitRoot.textContent?.match(/FX/g)?.length || 0).toBe(1);
  });
});

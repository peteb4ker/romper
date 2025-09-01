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
    colorClass: "",
    isValid: true,
    kit: "A1",
    kitData: {
      name: "A1",
      voices: [
        { voice_alias: "Loop", voice_number: 1 },
        { voice_alias: "Loop", voice_number: 2 },
        { voice_alias: "Kick", voice_number: 3 },
        { voice_alias: "Loop", voice_number: 4 },
      ],
    },
    onDuplicate: vi.fn(),
    onSelect: vi.fn(),
    sampleCounts: [12, 12, 12, 12],
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
    fireEvent.click(dupBtn);
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

  describe("search match indicators", () => {
    const basePropsWithSearchMatch = {
      ...baseProps,
      kitData: {
        ...baseProps.kitData,
        searchMatch: {
          matchedArtist: "Test Artist",
          matchedOn: ["sample", "artist"],
          matchedSamples: ["kick_001.wav", "snare_001.wav"],
          matchedVoices: [],
        },
      },
    };

    it("renders search match badges when searchMatch data is present", () => {
      render(<KitItem {...basePropsWithSearchMatch} />);

      // Check for sample match badge
      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(sampleBadge).toBeInTheDocument();
      expect(sampleBadge).toHaveTextContent("📄 2");

      // Check for artist match badge
      const artistBadge = screen.getByText("🎵 Test Artist");
      expect(artistBadge).toBeInTheDocument();
    });

    it("renders alias match badge", () => {
      const props = {
        ...baseProps,
        kitData: {
          ...baseProps.kitData,
          searchMatch: {
            matchedAlias: "My Custom Kit",
            matchedOn: ["alias"],
            matchedSamples: [],
            matchedVoices: [],
          },
        },
      };
      render(<KitItem {...props} />);

      const aliasBadge = screen.getByText("🏷️ My Custom Kit");
      expect(aliasBadge).toBeInTheDocument();
    });

    it("shows single sample without count", () => {
      const props = {
        ...baseProps,
        kitData: {
          ...baseProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["single_sample.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitItem {...props} />);

      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(sampleBadge).toHaveTextContent("📄");
      expect(sampleBadge).not.toHaveTextContent("📄 1");
    });

    it("does not render search badges when no searchMatch data", () => {
      render(<KitItem {...baseProps} />);

      expect(screen.queryByTitle(/Sample matches:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🎵/)).not.toBeInTheDocument();
      expect(screen.queryByText(/🏷️/)).not.toBeInTheDocument();
    });

    it("does not render search badges when kit is invalid", () => {
      const props = {
        ...basePropsWithSearchMatch,
        isValid: false,
      };
      render(<KitItem {...props} />);

      expect(screen.queryByTitle(/Sample matches:/)).not.toBeInTheDocument();
    });

    it("has proper tooltip for sample matches", () => {
      const props = {
        ...baseProps,
        kitData: {
          ...baseProps.kitData,
          searchMatch: {
            matchedOn: ["sample"],
            matchedSamples: ["kick.wav", "snare.wav", "hihat.wav"],
            matchedVoices: [],
          },
        },
      };
      render(<KitItem {...props} />);

      const sampleBadge = screen.getByTitle(/Sample matches:/);
      expect(sampleBadge).toBeInTheDocument();
    });
  });
});

describe("KitItem voice label deduplication", () => {
  it("renders each voice label only once (array)", () => {
    const kitData = {
      name: "Test Kit",
      voices: [
        { voice_alias: "vox", voice_number: 1 },
        { voice_alias: "vox", voice_number: 2 },
        { voice_alias: "synth", voice_number: 3 },
        { voice_alias: "fx", voice_number: 4 },
      ],
    };
    render(
      <KitItem
        colorClass=""
        isValid={true}
        kit="Test Kit"
        kitData={kitData}
        onDuplicate={() => {}}
        onSelect={() => {}}
        sampleCounts={[12, 12, 12, 12]}
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
    expect(getLabel("FX").length).toBe(1); // Note: toCapitalCase converts "fx" to "FX"
    // Ensure no duplicate deduped labels
    expect((kitRoot.textContent?.match(/Vox/g) || []).length).toBe(1);
    expect((kitRoot.textContent?.match(/Synth/g) || []).length).toBe(1);
    expect((kitRoot.textContent?.match(/FX/g) || []).length).toBe(1);
  });
});

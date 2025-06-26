// Tests for RTF artist scanner

import { beforeEach, describe, expect, it } from "vitest";

import { scanRTFArtist } from "../rtfArtistScanner";

beforeEach(() => {
  // No mocks needed for this scanner as it's pure string processing
});

describe("scanRTFArtist", () => {
  it("successfully extracts artist names from valid RTF filenames", () => {
    const input = {
      rtfFiles: [
        "A - Artist One.rtf",
        "B - Artist Two.rtf",
        "C - Some Long Artist Name.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Artist One",
        B: "Artist Two",
        C: "Some Long Artist Name",
      },
    });
  });

  it("handles empty RTF files array", () => {
    const input = { rtfFiles: [] };
    const result = scanRTFArtist(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No valid RTF files found");
  });

  it("handles undefined RTF files", () => {
    const input = { rtfFiles: undefined as any };
    const result = scanRTFArtist(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No valid RTF files found");
  });

  it("handles files with invalid naming pattern", () => {
    const input = {
      rtfFiles: ["invalid.rtf", "no-dash.rtf", "A.rtf", "- No Bank.rtf"],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No valid RTF files found");
  });

  it("handles mixed valid and invalid filenames", () => {
    const input = {
      rtfFiles: [
        "A - Valid Artist.rtf",
        "invalid.rtf",
        "B - Another Valid Artist.rtf",
        "no-dash.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Valid Artist",
        B: "Another Valid Artist",
      },
    });
  });

  it("handles files with full paths", () => {
    const input = {
      rtfFiles: [
        "/path/to/A - Artist One.rtf",
        "C:\\Users\\test\\B - Artist Two.rtf",
        "./relative/C - Artist Three.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Artist One",
        B: "Artist Two",
        C: "Artist Three",
      },
    });
  });

  it("handles artist names with extra whitespace", () => {
    const input = {
      rtfFiles: [
        "A -   Artist With Spaces   .rtf",
        "B-Artist No Spaces.rtf",
        "C   -   Lots Of Spaces   .rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Artist With Spaces",
        B: "Artist No Spaces",
        C: "Lots Of Spaces",
      },
    });
  });

  it("handles lowercase bank letters", () => {
    const input = {
      rtfFiles: ["a - Artist One.rtf", "b - Artist Two.rtf"],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Artist One",
        B: "Artist Two",
      },
    });
  });

  it("handles empty artist names", () => {
    const input = {
      rtfFiles: ["A - .rtf", "B -   .rtf", "C - Valid Artist.rtf"],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        C: "Valid Artist",
      },
    });
  });

  it("handles duplicate bank letters (last one wins)", () => {
    const input = {
      rtfFiles: [
        "A - First Artist.rtf",
        "A - Second Artist.rtf",
        "B - Another Artist.rtf",
      ],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Second Artist",
        B: "Another Artist",
      },
    });
  });

  it("handles exceptions during processing", () => {
    // This is a bit contrived since the function is pure, but let's test edge cases
    const input = {
      rtfFiles: [null as any, undefined as any, "A - Valid.rtf"],
    };

    const result = scanRTFArtist(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bankArtists: {
        A: "Valid",
      },
    });
  });
});

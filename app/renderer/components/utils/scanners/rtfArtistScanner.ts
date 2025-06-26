// RTF artist metadata scanner - extracts artist names from RTF filenames

import type { RTFArtistInput, RTFArtistOutput, ScanResult } from "./types";

/**
 * Scans RTF files and extracts artist names from filenames
 * @param input Object containing RTF file paths
 * @returns Artist names mapped by bank letter
 */
export function scanRTFArtist(
  input: RTFArtistInput,
): ScanResult<RTFArtistOutput> {
  try {
    const { rtfFiles } = input;
    const bankArtists: Record<string, string> = {};

    if (!rtfFiles || rtfFiles.length === 0) {
      return {
        success: false,
        error: "No valid RTF files found",
      };
    }

    // Process each RTF file
    for (const filePath of rtfFiles) {
      // Skip null/undefined values
      if (!filePath || typeof filePath !== "string") {
        continue;
      }

      const filename = filePath.split(/[/\\]/).pop() || "";

      // Extract artist name from filename pattern: "A - Artist Name.rtf"
      const match = filename.match(/^([A-Z])\s*-\s*(.+)\.rtf$/i);

      if (match) {
        const bankLetter = match[1].toUpperCase();
        const artistName = match[2].trim();

        if (artistName) {
          bankArtists[bankLetter] = artistName;
        }
      }
    }

    // Check if we found any artists
    if (Object.keys(bankArtists).length === 0) {
      return {
        success: false,
        error: "No valid RTF files found",
      };
    }

    return {
      success: true,
      data: { bankArtists },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during RTF artist scanning",
    };
  }
}

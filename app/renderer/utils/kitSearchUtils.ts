import type { KitWithRelations } from "@romper/shared/db/schema";

import type {
  KitWithSearchMatch,
  SearchMatchDetails,
} from "../components/shared/kitItemUtils";

/**
 * Client-side search filter utilities
 * Provides functions for filtering kits based on query strings and tracking match details for UI indicators
 */

/**
 * Check kit basic fields (name, alias, artist) for search matches
 */
export function checkKitBasicFields(
  kit: KitWithRelations,
  searchTerm: string,
  matchDetails: SearchMatchDetails,
): void {
  // Check kit name
  if (kit.name?.toLowerCase().includes(searchTerm)) {
    matchDetails.matchedOn.push("name");
  }

  // Check kit alias
  if (kit.alias && kit.alias.toLowerCase().includes(searchTerm)) {
    matchDetails.matchedOn.push("alias");
    matchDetails.matchedAlias = kit.alias;
  }

  // Check artist (from bank)
  if (kit.bank?.artist && kit.bank.artist.toLowerCase().includes(searchTerm)) {
    matchDetails.matchedOn.push("artist");
    matchDetails.matchedArtist = kit.bank.artist;
  }
}

/**
 * Check kit samples for search matches
 */
export function checkKitSamples(
  kit: KitWithRelations,
  searchTerm: string,
  matchDetails: SearchMatchDetails,
  allKitSamples: { [kit: string]: unknown },
): void {
  // Check sample filenames using allKitSamples data
  const kitSamples = allKitSamples[kit.name];
  if (kitSamples && typeof kitSamples === "object" && kitSamples !== null) {
    for (const voiceKey of Object.keys(kitSamples)) {
      const voiceSamples = (kitSamples as Record<string, unknown>)[voiceKey];
      if (Array.isArray(voiceSamples)) {
        for (const sample of voiceSamples) {
          if (
            sample?.filename &&
            sample.filename.toLowerCase().includes(searchTerm)
          ) {
            matchDetails.matchedOn.push(`sample:${sample.filename}`);
            matchDetails.matchedSamples.push(sample.filename);
          }
        }
      }
    }
  }

  // Also check kit.samples if available (for backward compatibility)
  if (kit.samples) {
    for (const sample of kit.samples) {
      if (
        sample.filename &&
        sample.filename.toLowerCase().includes(searchTerm)
      ) {
        matchDetails.matchedOn.push(`sample:${sample.filename}`);
        matchDetails.matchedSamples.push(sample.filename);
      }
    }
  }
}

/**
 * Check kit voices for search matches
 */
export function checkKitVoices(
  kit: KitWithRelations,
  searchTerm: string,
  matchDetails: SearchMatchDetails,
): void {
  if (!kit.voices) return;

  for (const voice of kit.voices) {
    if (
      voice.voice_alias &&
      voice.voice_alias.toLowerCase().includes(searchTerm)
    ) {
      matchDetails.matchedOn.push(`voice:${voice.voice_alias}`);
      matchDetails.matchedVoices.push(voice.voice_alias);
    }
  }
}

/**
 * Filter kits based on search query and return results with match details
 */
export function filterKitsWithSearch(
  kits: KitWithRelations[],
  query: string,
  allKitSamples: { [kit: string]: unknown } = {},
): KitWithSearchMatch[] {
  if (!query || query.length < 2) {
    return kits.map((kit) => ({ ...kit })); // Return all kits without search matches
  }

  const searchTerm = query.toLowerCase().trim();
  const results: KitWithSearchMatch[] = [];

  for (const kit of kits) {
    const matchDetails: SearchMatchDetails = {
      matchedOn: [],
      matchedSamples: [],
      matchedVoices: [],
    };

    checkKitBasicFields(kit, searchTerm, matchDetails);
    checkKitVoices(kit, searchTerm, matchDetails);
    checkKitSamples(kit, searchTerm, matchDetails, allKitSamples);

    // If any matches found, add to results
    if (matchDetails.matchedOn.length > 0) {
      results.push({
        ...kit,
        searchMatch: matchDetails,
      });
    }
  }

  // Sort by kit name for consistent ordering
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

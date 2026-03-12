import type { KitWithRelations } from "@romper/shared/db/schema";

import type {
  KitWithSearchMatch,
  SearchMatchDetails,
} from "../components/shared/kitItemUtils";

/**
 * Client-side search filter utilities
 * Provides functions for filtering kits based on query strings and tracking match details for UI indicators
 */

interface SampleWithVoice {
  filename: string;
  voiceNumber: null | number;
}

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
  if (kit.alias?.toLowerCase().includes(searchTerm)) {
    matchDetails.matchedOn.push("alias");
    matchDetails.matchedAlias = kit.alias;
  }

  // Check artist (from bank)
  if (kit.bank?.artist?.toLowerCase().includes(searchTerm)) {
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
  const samples = [
    ...getSamplesFromAllKitSamples(kit, allKitSamples),
    ...getSamplesFromKitRelation(kit),
  ];

  for (const { filename, voiceNumber } of samples) {
    if (filename.toLowerCase().includes(searchTerm)) {
      matchDetails.matchedOn.push(`sample:${filename}`);
      matchDetails.matchedSamples.push(filename);
      if (voiceNumber != null) {
        if (!matchDetails.matchedSamplesByVoice) {
          matchDetails.matchedSamplesByVoice = {};
        }
        if (!matchDetails.matchedSamplesByVoice[voiceNumber]) {
          matchDetails.matchedSamplesByVoice[voiceNumber] = [];
        }
        matchDetails.matchedSamplesByVoice[voiceNumber].push(filename);
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
    if (voice.voice_alias?.toLowerCase().includes(searchTerm)) {
      matchDetails.matchedOn.push(`voice:${voice.voice_alias}`);
      matchDetails.matchedVoices.push(voice.voice_alias);
    }
  }

  // Match "stereo" against kits with stereo-linked voices
  if ("stereo".includes(searchTerm) || searchTerm.includes("stereo")) {
    const hasStereo = kit.voices.some((v) => v.stereo_mode);
    if (hasStereo && !matchDetails.matchedOn.includes("stereo")) {
      matchDetails.matchedOn.push("stereo");
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
      searchTerm,
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

/**
 * Extract sample filenames from allKitSamples object structure
 */
function getSamplesFromAllKitSamples(
  kit: KitWithRelations,
  allKitSamples: { [kit: string]: unknown },
): SampleWithVoice[] {
  const kitSamples = allKitSamples[kit.name];
  if (!kitSamples || typeof kitSamples !== "object") return [];

  const results: SampleWithVoice[] = [];
  for (const voiceKey of Object.keys(kitSamples)) {
    const voiceNumber = Number.parseInt(voiceKey, 10);
    const voiceSamples = (kitSamples as Record<string, unknown>)[voiceKey];
    if (!Array.isArray(voiceSamples)) continue;
    for (const sample of voiceSamples) {
      if (sample?.filename) {
        results.push({
          filename: sample.filename,
          voiceNumber: Number.isNaN(voiceNumber) ? null : voiceNumber,
        });
      }
    }
  }
  return results;
}

/**
 * Extract sample filenames from kit.samples relation
 */
function getSamplesFromKitRelation(kit: KitWithRelations): SampleWithVoice[] {
  if (!kit.samples) return [];
  return kit.samples
    .filter((sample) => !!sample.filename)
    .map((sample) => ({
      filename: sample.filename!,
      voiceNumber: sample.voice_number,
    }));
}

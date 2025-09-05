import type { Kit, KitWithRelations } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

const { banks, samples, voices } = schema;

/**
 * Type for lookup maps used to efficiently join data
 */
export interface KitLookups {
  bankLookup: Map<string, typeof banks.$inferSelect>;
  samplesLookup: Map<string, (typeof samples.$inferSelect)[]>;
  voicesLookup: Map<string, (typeof voices.$inferSelect)[]>;
}

/**
 * Type for kit-related data fetched in batch queries
 */
export interface KitRelatedData {
  banks: (typeof banks.$inferSelect)[];
  samples: (typeof samples.$inferSelect)[];
  voices: (typeof voices.$inferSelect)[];
}

/**
 * Combine a kit with its related data using the provided lookups
 * Returns a kit with all related data attached
 */
export function combineKitWithRelations(
  kit: Kit,
  lookups: KitLookups,
): KitWithRelations {
  const { bankLookup, samplesLookup, voicesLookup } = lookups;

  return {
    ...kit,
    bank: kit.bank_letter ? bankLookup.get(kit.bank_letter) || null : null,
    samples: samplesLookup.get(kit.name) || [],
    voices: voicesLookup.get(kit.name) || [],
  };
}

/**
 * Create lookup maps for efficient data joining
 * Maps are used to avoid O(n²) lookup complexity when combining data
 */
export function createKitLookups(relatedData: KitRelatedData): KitLookups {
  const {
    banks: allBanks,
    samples: allSamples,
    voices: allVoices,
  } = relatedData;

  // Create lookups for efficient joining
  const bankLookup = new Map(allBanks.map((b) => [b.letter, b]));
  const voicesLookup = new Map<string, typeof allVoices>();
  const samplesLookup = new Map<string, typeof allSamples>();

  allVoices.forEach((v) => {
    if (!voicesLookup.has(v.kit_name)) voicesLookup.set(v.kit_name, []);
    voicesLookup.get(v.kit_name)!.push(v);
  });

  allSamples.forEach((s) => {
    if (!samplesLookup.has(s.kit_name)) samplesLookup.set(s.kit_name, []);
    samplesLookup.get(s.kit_name)!.push(s);
  });

  return {
    bankLookup,
    samplesLookup,
    voicesLookup,
  };
}

/**
 * Fetch all related data for the given kit names in batch queries
 * This eliminates N+1 query problems by fetching all related data at once
 */
export function fetchKitRelatedData(
  db: ReturnType<typeof drizzle<typeof schema>>,
  kitNames: string[],
): KitRelatedData {
  const allBanks = db.select().from(banks).all();
  const allVoices = db
    .select()
    .from(voices)
    .where(inArray(voices.kit_name, kitNames))
    .orderBy(voices.voice_number)
    .all();
  const allSamples = db
    .select()
    .from(samples)
    .where(inArray(samples.kit_name, kitNames))
    .orderBy(samples.voice_number, samples.slot_number)
    .all();

  return {
    banks: allBanks,
    samples: allSamples,
    voices: allVoices,
  };
}

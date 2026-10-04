import type { Sample } from "@romper/shared/db/schema.js";

import {
  planKitStereo,
  type StereoSampleState,
  type WriteStereoSummary,
} from "@romper/shared/stereoLinkRules.js";

import type { SyncPlanData } from "../db/operations/kitSyncOperations.js";

/** What planning learned about a sample's file */
export interface PlannedSampleFile {
  /** The channel count from the file's header, when it was read */
  channels?: number;
  /** The file is there, but its WAV can't be read */
  unreadable: boolean;
}

export interface WriteStereoPlan {
  /** The voices as the write treats them: automatic links included */
  effectiveVoices: PlanVoices;
  /** Kits not written; their folder on the card is kept as it is */
  quarantinedKits: Set<string>;
  summary: WriteStereoSummary;
}

type PlanVoices = SyncPlanData["voices"];

/**
 * Apply the stereo rules to every kit a write plans (#537), from the
 * channel counts in the files' headers (the store's copy when a file
 * wasn't read):
 *
 * - rule 2: pairs to link automatically, for kits that are written;
 * - rule 1: mono voices whose stereo samples are mixed down;
 * - rule 4: quarantined kits, which aren't written.
 *
 * Pure: the write makes the links.
 */
export function planWriteStereo(
  samples: readonly Sample[],
  files: readonly PlannedSampleFile[],
  voices: PlanVoices,
): WriteStereoPlan {
  const samplesByKit = new Map<string, StereoSampleState[]>();
  samples.forEach((sample, i) => {
    const list = samplesByKit.get(sample.kit_name) ?? [];
    list.push({
      filename: sample.filename,
      unreadable: files[i]?.unreadable ?? false,
      voice_number: sample.voice_number,
      wav_channels: files[i]?.channels ?? sample.wav_channels,
    });
    samplesByKit.set(sample.kit_name, list);
  });
  const voicesByKit = new Map<string, PlanVoices>();
  for (const voice of voices) {
    const list = voicesByKit.get(voice.kit_name) ?? [];
    list.push(voice);
    voicesByKit.set(voice.kit_name, list);
  }

  const summary: WriteStereoSummary = {
    autoLinks: [],
    mixdowns: [],
    quarantined: [],
  };
  const quarantinedKits = new Set<string>();
  const linkedVoices = new Set<string>();

  for (const kitName of [...samplesByKit.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const plan = planKitStereo(
      voicesByKit.get(kitName) ?? [],
      samplesByKit.get(kitName) ?? [],
    );
    if (plan.quarantine.length > 0) {
      quarantinedKits.add(kitName);
      summary.quarantined.push({ kitName, problems: plan.quarantine });
      continue;
    }
    for (const voiceNumber of plan.autoLinks) {
      summary.autoLinks.push({ kitName, voiceNumber });
    }
    for (const mixdown of plan.mixdowns) {
      summary.mixdowns.push({ kitName, ...mixdown });
    }
    for (const voiceNumber of plan.links) {
      linkedVoices.add(`${kitName}:${voiceNumber}`);
    }
  }

  const effectiveVoices = voices.map((voice) =>
    linkedVoices.has(`${voice.kit_name}:${voice.voice_number}`)
      ? { ...voice, stereo_mode: true }
      : voice,
  );
  return { effectiveVoices, quarantinedKits, summary };
}

// Stereo pairs, by Pete's "Final stereo rules v2" on #537 (with #541 and
// #574). One module for main and the renderer: setup, scan reports, the
// write, main's `updateVoiceStereoMode`, the link button, drops and the
// kit editor's labels all read the rules and their words from here.
//
// From the Rample manual (https://squarp.net/rample/manual/), STEREO
// SUPPORT: "A stereo sample will fill 2 mono voices." Multi-layers kits:
// "All layers must be of the same type (mono OR stereo) in a voice."
// Everything else here is Romper's design, unverified on hardware: pairing
// voice N with N+1, voice 4 always being a mono voice, mixing stereo
// samples down on a mono voice, linking automatically, and quarantine.
//
// Terms: a stereo or mono sample is a 2- or 1-channel WAV; a mono voice is
// an unlinked voice (voice 4 always is); a stereo pair is voices N and N+1
// linked, N 1-3. Say "link" and "unlink", never "busy" or "in use".

/** The Rample has four voices; voice 4 is always a mono voice. */
const LAST_VOICE = 4;

/** What rules 1-4 make of a kit */
export interface KitStereoPlan {
  /** Voices rule 2 links with the next one (setup and write do it) */
  autoLinks: number[];
  /** Voices linked once `autoLinks` are made: each pairs with the next */
  links: number[];
  /** Mono voices whose stereo samples are mixed down at write (rule 1) */
  mixdowns: StereoMixdown[];
  /** Why the kit is quarantined (rule 4); empty when it isn't */
  quarantine: QuarantineProblem[];
}

/** Why a kit is quarantined (rule 4): not written, card copy untouched */
export type QuarantineProblem =
  | { filename: string; kind: "mono_in_pair"; voiceNumber: number }
  | { filename: string; kind: "unreadable"; voiceNumber: number }
  | { kind: "right_voice_has_samples"; voiceNumber: number };

/** A voice's stereo choice: chosen by hand, or null when Romper may decide */
export type StereoChoice = "mono" | "stereo" | null;

export type StereoLinkCheck =
  | { canLink: false; message: string; reason: StereoLinkRefusal }
  | { canLink: true };

/**
 * Why voice N can't be linked with N+1 by hand (#541). Voice N can be
 * linked when it's 1-3, N+1 has no samples, and neither voice is in a pair.
 */
export type StereoLinkRefusal =
  | "next_voice_has_samples"
  | "next_voice_in_pair"
  | "no_next_voice"
  | "voice_in_pair";

/** A mono voice whose stereo samples are mixed down at write (rule 1) */
export interface StereoMixdown {
  /** next_voice_in_pair: N+1 is an empty pair's voice; rule 3's note */
  reason: "mono_voice" | "next_voice_in_pair";
  voiceNumber: number;
}

/** The sample fields the rules read */
export interface StereoSampleState {
  filename?: string;
  /** The WAV can't be read (rule 4). Unknown channels alone aren't this. */
  unreadable?: boolean;
  voice_number: number;
  wav_channels?: null | number;
}

/** The voice fields the rules read */
export interface StereoVoiceState {
  /** The user's choice (Keep mono or unlink: "mono"; linking: "stereo") */
  stereo_choice?: null | StereoChoice | string;
  stereo_mode: boolean;
  voice_number: number;
}

/** What a write does about stereo, by kit (#537): its summary lists it */
export interface WriteStereoSummary {
  /** Pairs the write links automatically (rule 2) */
  autoLinks: Array<{ kitName: string; voiceNumber: number }>;
  /** Mono voices whose stereo samples are mixed down (rule 1) */
  mixdowns: Array<{ kitName: string } & StereoMixdown>;
  /** Kits not written, whose copy on the card is left as it is (rule 4) */
  quarantined: Array<{ kitName: string; problems: QuarantineProblem[] }>;
}

interface KitView {
  choiceOf: (n: number) => null | string;
  inPair: (n: number) => boolean;
  /** Linked voices; `linkAutomatically` adds to it */
  linked: Set<number>;
  onVoice: (n: number) => readonly StereoSampleState[];
}

/**
 * Whether voice `voiceNumber` can be linked with the next voice by hand
 * (the link button, or main for any caller, #541). The refusal's message
 * is the approved one ("Voices 2 and 3 can't be linked: voice 3 has
 * samples."). Unlinking is always allowed and isn't checked here.
 */
export function checkStereoLink(
  voiceNumber: number,
  voices: readonly StereoVoiceState[],
  samples: readonly StereoSampleState[],
): StereoLinkCheck {
  const reason = stereoLinkRefusal(voiceNumber, voices, samples);
  if (!reason) return { canLink: true };
  return {
    canLink: false,
    message: describeLinkRefusal(voiceNumber, reason),
    reason,
  };
}

/** Linked, with no choice by hand: Romper linked it (rule 2's label) */
export function isLinkedAutomatically(voice: StereoVoiceState): boolean {
  return voice.stereo_mode && voice.stereo_choice !== "stereo";
}

/** A 2-channel (or wider) sample; an unknown channel count is neither */
export function isStereoSample(sample: StereoSampleState): boolean {
  return (sample.wav_channels ?? 0) > 1;
}

/**
 * Apply rules 1-4 to a kit. Pure: the caller makes the links.
 *
 * - Rule 2: voice N (1-3) is linked automatically when every sample on it
 *   is stereo, N+1 has no samples and isn't in a pair, N isn't in a pair,
 *   and the user hasn't chosen mono for N. Voices are taken in order, each
 *   against the links before it.
 * - Rule 3: existing links are never undone.
 * - Rule 1: a mono voice holding stereo samples is mixed down at write;
 *   when N+1 is in a pair, rule 3's note says why N can't pair.
 * - Rule 4: a pair with a mono sample on its voice, a pair whose right
 *   voice has samples, or a WAV that can't be read quarantines the kit.
 */
export function planKitStereo(
  voices: readonly StereoVoiceState[],
  samples: readonly StereoSampleState[],
): KitStereoPlan {
  const kit = kitView(voices, samples);
  const autoLinks = linkAutomatically(kit);

  const mixdowns: StereoMixdown[] = [];
  const quarantine: QuarantineProblem[] = [];
  for (let n = 1; n <= LAST_VOICE; n++) {
    if (kit.linked.has(n)) {
      quarantine.push(...pairProblems(kit, n));
    } else if (!kit.linked.has(n - 1) && kit.onVoice(n).some(isStereoSample)) {
      mixdowns.push({
        // Rule 3's note only where unlinking the pair would let N pair
        reason:
          n < LAST_VOICE &&
          kit.linked.has(n + 1) &&
          kit.onVoice(n + 1).length === 0
            ? "next_voice_in_pair"
            : "mono_voice",
        voiceNumber: n,
      });
    }
    for (const sample of kit.onVoice(n)) {
      if (sample.unreadable) {
        quarantine.push({
          filename: sample.filename ?? "",
          kind: "unreadable",
          voiceNumber: n,
        });
      }
    }
  }

  return {
    autoLinks,
    links: [...kit.linked].sort((a, b) => a - b),
    mixdowns,
    quarantine,
  };
}

function kitView(
  voices: readonly StereoVoiceState[],
  samples: readonly StereoSampleState[],
): KitView {
  const linked = new Set(
    voices.filter((v) => v.stereo_mode).map((v) => v.voice_number),
  );
  return {
    choiceOf: (n) =>
      voices.find((v) => v.voice_number === n)?.stereo_choice ?? null,
    inPair: (n) => linked.has(n) || linked.has(n - 1),
    linked,
    onVoice: (n) => samples.filter((s) => s.voice_number === n),
  };
}

/** Rule 2's links, in voice order, added to `kit.linked` */
function linkAutomatically(kit: KitView): number[] {
  const autoLinks: number[] = [];
  for (let n = 1; n < LAST_VOICE; n++) {
    const own = kit.onVoice(n);
    if (
      own.length > 0 &&
      own.every(isStereoSample) &&
      !kit.inPair(n) &&
      !kit.inPair(n + 1) &&
      kit.onVoice(n + 1).length === 0 &&
      kit.choiceOf(n) !== "mono"
    ) {
      kit.linked.add(n);
      autoLinks.push(n);
    }
  }
  return autoLinks;
}

/** Rule 4's problems with the pair on voices n and n+1 */
function pairProblems(kit: KitView, n: number): QuarantineProblem[] {
  const problems: QuarantineProblem[] = kit
    .onVoice(n)
    .filter((sample) => sample.wav_channels === 1)
    .map((sample) => ({
      filename: sample.filename ?? "",
      kind: "mono_in_pair",
      voiceNumber: n,
    }));
  if (kit.onVoice(n + 1).length > 0) {
    problems.push({ kind: "right_voice_has_samples", voiceNumber: n });
  }
  return problems;
}

// --- Wording -------------------------------------------------------------
// Approved by Pete: the drop prompt, the link refusal reasons, the unlink
// message, the "can't pair" note and the mono-sample warning. Everything
// marked DRAFT awaits his sign-off.

/** Persistent labels (DRAFT) */
export const STEREO_LABELS = {
  /** On a pair Romper linked (rule 2) */
  linkedAutomatically: "Linked automatically",
  /** On a mono sample in a stereo pair (rule 4) */
  monoInPair: "Mono sample in a stereo pair",
  /** On a quarantined kit (rule 4) */
  quarantined: "Quarantined",
} as const;

/**
 * Approved: the link button, or main, refuses a link.
 * "Voices 2 and 3 can't be linked: voice 3 has samples."
 */
export function describeLinkRefusal(
  voiceNumber: number,
  reason: StereoLinkRefusal,
): string {
  if (reason === "no_next_voice") {
    return `Voice ${voiceNumber} can't be linked.`;
  }
  return `Voices ${voiceNumber} and ${voiceNumber + 1} can't be linked: ${refusalReason(voiceNumber, reason)}.`;
}

/**
 * The persistent note on a mono voice whose stereo samples are mixed down
 * (rule 1, DRAFT from Pete's example), or rule 3's note (approved) when
 * its next voice is in a pair.
 */
export function describeMixdownNote({
  reason,
  voiceNumber: n,
}: StereoMixdown): string {
  if (reason === "next_voice_in_pair") {
    return `Voice ${n} can't pair with voice ${n + 1} because voices ${n + 1} and ${n + 2} are linked. Unlink them to pair voices ${n} and ${n + 1}.`;
  }
  return "Mixed down to mono instead of playing across 2 voices";
}

/**
 * Approved: a mono sample dropped on a stereo pair.
 * "kick.wav is a mono sample, but voices 1 and 2 are a stereo pair and
 * expect stereo samples."
 */
export function describeMonoOnStereoPair(
  fileName: string,
  voiceNumber: number,
): string {
  return `${fileName} is a mono sample, but voices ${voiceNumber} and ${voiceNumber + 1} are a stereo pair and expect stereo samples.`;
}

/** What makes a kit quarantined, and how to fix it (DRAFT) */
export function describeQuarantineProblem(problem: QuarantineProblem): string {
  const n = problem.voiceNumber;
  switch (problem.kind) {
    case "mono_in_pair":
      return `${problem.filename} is a mono sample in the stereo pair on voices ${n} and ${n + 1}. Unlink them, or replace ${problem.filename} with a stereo sample.`;
    case "right_voice_has_samples":
      return `Voices ${n} and ${n + 1} are a stereo pair, but voice ${n + 1} has samples. Unlink them, or remove the samples from voice ${n + 1}.`;
    case "unreadable":
      return `Romper can't read ${problem.filename}. Replace it with a WAV Romper can read, or remove it.`;
  }
}

/** The kit editor's quarantine notice heading (DRAFT) */
export const QUARANTINE_NOTICE =
  "This kit is quarantined: it won't be written to the card until this is fixed.";

/** The write summary's heading for a quarantined kit (DRAFT) */
export function describeQuarantinedKit(kitName: string): string {
  return `Kit ${kitName} is quarantined, so it won't be written and its copy on the card stays as it is.`;
}

/** The setup summary's line for a pair it linked (DRAFT) */
export function describeSetupAutoLink(
  kitName: string,
  voiceNumber: number,
): string {
  return `Kit ${kitName}: voices ${voiceNumber} and ${voiceNumber + 1} linked automatically as a stereo pair.`;
}

/**
 * Approved: the question a drop asks of a stereo sample on a mono voice
 * that rule 2 would link. "kick.wav is stereo. Link voices 1 and 2 as a
 * stereo pair?"
 */
export function describeStereoDropPrompt(
  fileName: string,
  voiceNumber: number,
): string {
  return `${fileName} is stereo. Link voices ${voiceNumber} and ${voiceNumber + 1} as a stereo pair?`;
}

/**
 * Approved: after an unlink. "Voices 1 and 2 are unlinked. Voice 1's
 * stereo samples will be written to the card as mono." The second sentence
 * only when the voice holds stereo samples.
 */
export function describeUnlink(
  voiceNumber: number,
  hasStereoSamples: boolean,
): string {
  const unlinked = `Voices ${voiceNumber} and ${voiceNumber + 1} are unlinked.`;
  return hasStereoSamples
    ? `${unlinked} Voice ${voiceNumber}'s stereo samples will be written to the card as mono.`
    : unlinked;
}

/** The write summary's and scan's line for a pair the write links (DRAFT) */
export function describeWriteAutoLink(
  kitName: string,
  voiceNumber: number,
): string {
  return `Kit ${kitName}: voices ${voiceNumber} and ${voiceNumber + 1} will be linked automatically as a stereo pair.`;
}

/** The write summary's and scan's line for a mixdown (DRAFT) */
export function describeWriteMixdown(
  kitName: string,
  voiceNumber: number,
): string {
  return `Kit ${kitName}: voice ${voiceNumber}'s stereo samples will be mixed down to mono.`;
}

/** The reason in the approved refusal's words, e.g. "voice 3 has samples" */
function refusalReason(voiceNumber: number, reason: StereoLinkRefusal) {
  switch (reason) {
    case "next_voice_has_samples":
      return `voice ${voiceNumber + 1} has samples`;
    case "next_voice_in_pair":
      return `voice ${voiceNumber + 1} is already in a stereo pair`;
    case "no_next_voice":
      return `voice ${voiceNumber} can't be linked`;
    case "voice_in_pair":
      return `voice ${voiceNumber} is already in a stereo pair`;
  }
}

function stereoLinkRefusal(
  voiceNumber: number,
  voices: readonly StereoVoiceState[],
  samples: readonly StereoSampleState[],
): null | StereoLinkRefusal {
  if (voiceNumber >= LAST_VOICE) return "no_next_voice";
  const isLinked = (n: number) =>
    voices.some((v) => v.voice_number === n && v.stereo_mode);
  const next = voiceNumber + 1;
  if (isLinked(voiceNumber) || isLinked(voiceNumber - 1)) {
    return "voice_in_pair";
  }
  if (samples.some((s) => s.voice_number === next)) {
    return "next_voice_has_samples";
  }
  if (isLinked(next)) return "next_voice_in_pair";
  return null;
}

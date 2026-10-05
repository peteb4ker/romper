/**
 * Messages for files a drop didn't add (RE-40). A drop of several files
 * gives one message, grouped by reason, naming the files:
 * "kick.wav wasn't added: voice 2 is full (12 samples). Delete one to make
 * room."
 */

export interface DropRejection {
  fileName: string;
  reason: DropRejectionReason;
}

/**
 * Why a dropped file wasn't added:
 * - `checkFailed`: Romper couldn't check the file or read the kit
 * - `duplicate`: the file is already in this voice
 * - `full`: the voice has no free slot left
 * - `notWav`: the file isn't a `.wav`
 * - `unreadable`: a `.wav` that can't be read as audio
 */
export type DropRejectionReason =
  | "checkFailed"
  | "duplicate"
  | "full"
  | "notWav"
  | "unreadable";

// Order the reasons appear in a combined message
const REASON_ORDER: DropRejectionReason[] = [
  "full",
  "duplicate",
  "notWav",
  "unreadable",
  "checkFailed",
];

// Names listed before the rest are counted ("and 2 more")
const MAX_NAMES = 3;

/**
 * One message for every file a drop rejected, or null when none were.
 * Errors on Romper's side (`checkFailed`) make it an error; reasons the
 * user can act on are a warning.
 */
export function formatDropRejections(
  rejections: DropRejection[],
  voice: number,
): { text: string; type: "error" | "warning" } | null {
  if (rejections.length === 0) return null;

  const sentences = REASON_ORDER.flatMap((reason) => {
    const names = rejections
      .filter((r) => r.reason === reason)
      .map((r) => r.fileName);
    return names.length > 0 ? [sentenceFor(reason, names, voice)] : [];
  });
  const type = rejections.some((r) => r.reason === "checkFailed")
    ? "error"
    : "warning";
  return { text: sentences.join(" "), type };
}

/** "a.wav", "a.wav and b.wav", "a.wav, b.wav, c.wav and 2 more files" */
export function listFileNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length <= MAX_NAMES) {
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }
  const rest = names.length - MAX_NAMES;
  return `${names.slice(0, MAX_NAMES).join(", ")} and ${rest} more ${
    rest === 1 ? "file" : "files"
  }`;
}

function sentenceFor(
  reason: DropRejectionReason,
  names: string[],
  voice: number,
): string {
  const one = names.length === 1;
  const subject = `${listFileNames(names)} ${one ? "wasn't" : "weren't"} added`;
  switch (reason) {
    case "checkFailed":
      return `${subject}: Romper couldn't check ${one ? "it" : "them"}. Try again.`;
    case "duplicate":
      return `${subject}: ${one ? "it's" : "they're"} already in voice ${voice}.`;
    case "full":
      return `${subject}: voice ${voice} is full (12 samples). Delete one to make room.`;
    case "notWav":
      return `${subject}: only WAV files can be added.`;
    case "unreadable":
      return `${subject}: ${one ? "it" : "they"} couldn't be read as WAV audio. Check the ${one ? "file" : "files"} and try again.`;
  }
}

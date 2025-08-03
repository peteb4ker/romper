// Shared kit utilities for both main and renderer

// For a list of given files, map them to the corresponding voice number
export function groupSamplesByVoice(files: string[]): {
  [voice: number]: string[];
} {
  const voices: { [voice: number]: string[] } = { 1: [], 2: [], 3: [], 4: [] };
  files.forEach((f) => {
    const match = /^([1-4])./.exec(f);
    if (match) {
      const voice = parseInt(match[1], 10);
      if (voices[voice]) voices[voice].push(f);
    }
  });
  Object.keys(voices).forEach((v) => {
    voices[+v].sort((a, b) => a.localeCompare(b));
  });
  return voices;
}

export function toCapitalCase(str: string): string {
  if (!str || typeof str !== "string") return "";
  let result = str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  // Always capitalize 'HH' and 'FX' as whole words
  result = result.replace(/\bHh\b/g, "HH").replace(/\bFx\b/g, "FX");
  return result;
}

const VOICE_TYPE_KEYWORDS: { [voice: string]: string[] } = {
  bass: ["bass", "808", "sub"],
  clap: ["clap"],
  closed_hh: [
    "hh closed",
    "hh close",
    "close",
    "ch",
    "chh",
    "closed",
    "cldHat",
  ],
  conga: ["conga"],
  crash: ["crash"],
  fx: ["fx", "effect", "laser"],
  hh: ["hihat", "hat", "hh"],
  kick: ["kick", "kk", "bd"],
  loop: ["loop"],
  open_hh: ["hh open", "oh", "open"],
  perc: ["perc", "glass", "clave"],
  ride: ["ride"],
  rim: ["rim"],
  snare: ["snare", "sn", "sd"],
  synth: ["pad", "stab", "bell", "chord", "lead", "saw", "JP8"],
  tom: ["tom", "floor tom"],
  vox: ["vox", "vocal", "voice"],
};

const VOICE_TYPE_PRECEDENCE = [
  "fx",
  "kick",
  "snare",
  "rim",
  "clap",
  "synth",
  "closed_hh",
  "open_hh",
  "hh",
  "perc",
  "tom",
  "ride",
  "crash",
  "bass",
  "vox",
  "loop",
  "conga",
];

// Compare kit slots by bank and number (e.g. 'A0', 'B10')
export function compareKitSlots(a: string, b: string): number {
  const bankA = a.charCodeAt(0);
  const bankB = b.charCodeAt(0);
  if (bankA !== bankB) return bankA - bankB;
  const numA = parseInt(a.slice(1), 10);
  const numB = parseInt(b.slice(1), 10);
  return numA - numB;
}

// Get the next available kit slot (e.g. 'A0', 'A1', ..., 'B0', ...)
export function getNextKitSlot(existing: string[]): null | string {
  const banks = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(65 + i),
  ); // 'A' to 'Z'
  for (const bank of banks) {
    for (let num = 0; num <= 99; num++) {
      const slot = `${bank}${num}`;
      if (!existing.includes(slot)) return slot;
    }
  }
  return null;
}

export function inferVoiceTypeFromFilename(filename: string): null | string {
  const name = filename.replace(/\.[^.]+$/, "").toLowerCase();

  // Try different matching strategies in order of specificity
  return (
    checkMultiWordKeywords(name) ||
    checkWordBoundaryKeywords(name) ||
    checkFlexibleKeywords(name)
  );
}

export function isValidKit(kit: string): boolean {
  // Valid kit: 1 uppercase letter A-Z, followed by 1-2 digits 0-99
  return /^\p{Lu}\d{1,2}$/u.test(kit) && parseInt(kit.slice(1), 10) <= 99;
}

export function showBankAnchor(
  kit: string,
  idx: number,
  kits: string[],
): boolean {
  // Show anchor if this is the first kit in a bank or the first kit overall
  if (idx === 0) return true;
  const prevKit = kits[idx - 1];
  return !prevKit.startsWith(kit[0]);
}

export function uniqueVoiceLabels(
  voiceNames: Record<number, string>,
): string[] {
  const seen = new Set<string>();
  return Object.values(voiceNames)
    .filter((label) => label && label.trim() !== "")
    .filter((label) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
}

// Helper function to check flexible keyword matches
function checkFlexibleKeywords(name: string): null | string {
  for (const type of VOICE_TYPE_PRECEDENCE) {
    const keywords = VOICE_TYPE_KEYWORDS[type];
    if (!Array.isArray(keywords)) continue;
    for (const keyword of keywords) {
      if (!keyword.includes(" ")) {
        if (
          name.startsWith(keyword) ||
          new RegExp(`^[1-4]${keyword}`, "i").test(name) ||
          name.includes(keyword)
        ) {
          return toCapitalCase(type);
        }
      }
    }
  }
  return null;
}

// Helper function to check multi-word keyword matches
function checkMultiWordKeywords(name: string): null | string {
  for (const type of VOICE_TYPE_PRECEDENCE) {
    const keywords = VOICE_TYPE_KEYWORDS[type];
    if (!Array.isArray(keywords)) continue;
    for (const keyword of keywords) {
      if (keyword.includes(" ")) {
        const words = keyword.split(/\s+/);
        if (words.every((w) => name.includes(w))) {
          return toCapitalCase(type);
        }
      }
    }
  }
  return null;
}

// Helper function to check word boundary keyword matches
function checkWordBoundaryKeywords(name: string): null | string {
  for (const type of VOICE_TYPE_PRECEDENCE) {
    const keywords = VOICE_TYPE_KEYWORDS[type];
    if (!Array.isArray(keywords)) continue;
    for (const keyword of keywords) {
      if (!keyword.includes(" ")) {
        if (new RegExp(`(^|\\W)${keyword}(?=\\W|$)`, "i").test(name)) {
          return toCapitalCase(type);
        }
      }
    }
  }
  return null;
}

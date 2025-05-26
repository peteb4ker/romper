// Utility functions for kit management and display

export function compareKitSlots(a: string, b: string): number {
    const bankA = a.charCodeAt(0), numA = parseInt(a.slice(1), 10);
    const bankB = b.charCodeAt(0), numB = parseInt(b.slice(1), 10);
    if (bankA !== bankB) return bankA - bankB;
    return numA - numB;
}

export function getNextKitSlot(existingKits: string[]): string | null {
    if (!existingKits || existingKits.length === 0) return 'A0';
    const sorted = existingKits
        .filter(k => /^[A-Z][0-9]{1,2}$/.test(k))
        .sort(compareKitSlots);
    const last = sorted[sorted.length - 1];
    let bank = last.charCodeAt(0);
    let num = parseInt(last.slice(1), 10);
    if (num < 99) {
        num++;
    } else if (bank < 'Z'.charCodeAt(0)) {
        bank++;
        num = 0;
    } else {
        return null;
    }
    const next = String.fromCharCode(bank) + num.toString();
    let tries = 0;
    while (sorted.includes(next) && tries < 2600) {
        if (num < 99) {
            num++;
        } else if (bank < 'Z'.charCodeAt(0)) {
            bank++;
            num = 0;
        } else {
            return null;
        }
        tries++;
    }
    if (tries >= 2600) return null;
    return String.fromCharCode(bank) + num.toString();
}

export const KIT_BANK_COLORS = [
    'text-cyan-700 dark:text-cyan-300',
    'text-pink-700 dark:text-pink-300',
    'text-amber-700 dark:text-amber-300',
    'text-green-700 dark:text-green-300',
    'text-blue-700 dark:text-blue-300',
    'text-purple-700 dark:text-purple-300',
    'text-orange-700 dark:text-orange-300',
    'text-lime-700 dark:text-lime-300',
    'text-fuchsia-700 dark:text-fuchsia-300',
    'text-teal-700 dark:text-teal-300',
    'text-rose-700 dark:text-rose-300',
    'text-violet-700 dark:text-violet-300',
];

export function getKitColorClass(kit: string): string {
    if (!/^[A-Z]/.test(kit)) return 'text-gray-400 dark:text-gray-500';
    const idx = (kit.charCodeAt(0) - 65) % KIT_BANK_COLORS.length;
    return KIT_BANK_COLORS[idx];
}

export function toCapitalCase(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Group .wav sample filenames by voice number (1-4).
 * @param files List of filenames (strings)
 * @returns Object mapping voice number to array of sample filenames
 */
export function groupSamplesByVoice(files: string[]): { [voice: number]: string[] } {
    const voices: { [voice: number]: string[] } = { 1: [], 2: [], 3: [], 4: [] };
    files.forEach(f => {
        const match = /^([1-4])./.exec(f);
        if (match) {
            const voice = parseInt(match[1], 10);
            if (voices[voice]) voices[voice].push(f);
        }
    });
    // Sort samples for each voice
    Object.keys(voices).forEach(v => voices[+v].sort());
    return voices;
}

// Streamlined and permissive voice type keywords
const VOICE_TYPE_KEYWORDS: { [voice: string]: string[] } = {
  kick: ["kick", "kk"],
  snare: ["snare", "sn", "sd"],
  clap: ["clap"],
  hh_closed: ["hh closed", "hh close", "close", "ch", "chh", "closed"],
  hh_open: ["hh open", "oh", "open"],
  hh: ["hihat", "hat", "hh"],
  perc: ["perc", "glass", "clave"],
  tom: ["tom", "floor tom"],
  rim: ["rim"],
  ride: ["ride"],
  crash: ["crash"],
  fx: ["fx", "effect", "laser"],
  bass: ["bass", "808", "sub"],
  vox: ["vox", "vocal", "voice"],
  synth: ["pad", "stab", "bell", "chord", "lead", "saw", "JP8"],
  loop: ["loop"],
  conga: ["conga"]
};

const VOICE_TYPE_PRECEDENCE = [
  "fx",
  "kick", "snare", "rim", "clap", "synth", "hh_closed", "hh_open", "hh", "perc", "tom", "ride", "crash", "bass", "vox", "loop", "conga"
];

export function inferVoiceTypeFromFilename(filename: string): string | null {
  const name = filename.replace(/\.[^.]+$/, '').toLowerCase();
  // 1. Try to match multi-word phrases first (e.g., 'hh closed', 'floor tom', 'snare low')
  for (const type of VOICE_TYPE_PRECEDENCE) {
    for (const keyword of VOICE_TYPE_KEYWORDS[type]) {
      if (keyword.includes(' ')) {
        // All words in the keyword must be present in the name (order-insensitive)
        const words = keyword.split(/\s+/);
        if (words.every(w => name.includes(w))) {
          return toCapitalCase(type);
        }
      }
    }
  }
  // 2. Try to match exact whole words for single-word keywords
  for (const type of VOICE_TYPE_PRECEDENCE) {
    for (const keyword of VOICE_TYPE_KEYWORDS[type]) {
      if (!keyword.includes(' ')) {
        // Match if keyword is a whole word (surrounded by non-word chars or string boundaries)
        if (new RegExp(`(^|\\W)${keyword}(?=\\W|$)`, 'i').test(name)) {
          return toCapitalCase(type);
        }
      }
    }
  }
  // 3. Fallback to word boundary/substring match for single-word keywords (legacy, permissive)
  for (const type of VOICE_TYPE_PRECEDENCE) {
    for (const keyword of VOICE_TYPE_KEYWORDS[type]) {
      if (!keyword.includes(' ')) {
        // Match if keyword is at the start of a word (word boundary) or after a digit
        if (new RegExp(`(?:\\b|(?<=\\d))${keyword}`, 'i').test(name)) {
          return toCapitalCase(type);
        }
      }
    }
  }
  return null;
}

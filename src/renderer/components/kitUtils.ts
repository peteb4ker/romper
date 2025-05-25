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

// Voice type inference mapping and function
const VOICE_TYPE_KEYWORDS: { [voice: string]: string[] } = {
  kick: ["kick", "bd", "kck", "kicklow", "kick_low", "kick low"],
  snare: ["snare", "sd", "sn", "snarelow", "snare_low", "snare low"],
  clap: ["clap", "clp"],
  hh_closed: ["ch", "chh", "closedhat", "closed_hh", "closed", "hh closed", "hh close"],
  hh_open: ["ohh", "openhat", "open_hh", "open", "hh open"],
  hh: ["hh", "hat", "hihat"],
  perc: ["perc", "percussion"],
  tom: [
    "tom", "lowtom", "hightom", "midtoms", "floor tom", "floortom", "floor_tom", "hi tom", "hitom", "hi_tom", "mid tom", "midtom", "mid_tom"
  ],
  rim: ["rim", "rimshot"],
  ride: [
    "ride", "ride cymbal", "ridecymbal", "ride_cymbal", "ride hi", "ridehi", "ride_hi"
  ],
  crash: ["crash"],
  fx: ["fx", "effect", "sfx", "laser"],
  bass: ["bass", "808", "sub"],
  vox: ["vox", "vocal", "voice"],
  synth: ["pad", "stab", "bell"]
};
const VOICE_TYPE_PRECEDENCE = [
  "kick", "snare", "clap", "hh_closed", "hh_open", "hh", "perc", "tom", "rim", "ride", "crash", "fx", "bass", "vox", "synth"
];

export function inferVoiceTypeFromFilename(filename: string): string | null {
  const name = filename.replace(/\.[^.]+$/, '').toLowerCase();
  // Try to match multi-word phrases first (e.g., 'snare low')
  for (const type of VOICE_TYPE_PRECEDENCE) {
    for (const keyword of VOICE_TYPE_KEYWORDS[type]) {
      if (keyword.includes(' ')) {
        if (name.includes(keyword)) {
          return toCapitalCase(type);
        }
      }
    }
  }
  // Fallback to original regex for single-word/abbreviations
  for (const type of VOICE_TYPE_PRECEDENCE) {
    for (const keyword of VOICE_TYPE_KEYWORDS[type]) {
      if (!keyword.includes(' ')) {
        if (new RegExp(`(^|[_.\-\s])${keyword}([_.\-\s0-9]|$)`).test(name)) {
          return toCapitalCase(type);
        }
      }
    }
  }
  return null;
}

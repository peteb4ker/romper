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

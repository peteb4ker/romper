// Utility functions for kit management and display

export * from '../../shared/kitUtilsShared';

export function compareKitSlots(a: string, b: string): number {
    // Sort by bank letter, then by number (A0, A1, ..., B0, ...)
    const bankA = a[0], bankB = b[0];
    if (bankA < bankB) return -1;
    if (bankA > bankB) return 1;
    const numA = parseInt(a.slice(1), 10);
    const numB = parseInt(b.slice(1), 10);
    return numA - numB;
}

export function getKitColorClass(kit: string): string {
    // Assign a color class based on the kit bank letter
    const bank = kit[0];
    const colors: Record<string, string> = {
        A: 'text-blue-600 dark:text-blue-300',
        B: 'text-green-600 dark:text-green-300',
        C: 'text-pink-600 dark:text-pink-300',
        D: 'text-yellow-600 dark:text-yellow-300',
        E: 'text-purple-600 dark:text-purple-300',
        F: 'text-orange-600 dark:text-orange-300',
        G: 'text-teal-600 dark:text-teal-300',
        H: 'text-red-600 dark:text-red-300',
        I: 'text-indigo-600 dark:text-indigo-300',
        J: 'text-lime-600 dark:text-lime-300',
        K: 'text-amber-600 dark:text-amber-300',
        L: 'text-cyan-600 dark:text-cyan-300',
        M: 'text-fuchsia-600 dark:text-fuchsia-300',
        N: 'text-emerald-600 dark:text-emerald-300',
        O: 'text-violet-600 dark:text-violet-300',
        P: 'text-rose-600 dark:text-rose-300',
        Q: 'text-sky-600 dark:text-sky-300',
        R: 'text-stone-600 dark:text-stone-300',
        S: 'text-gray-600 dark:text-gray-300',
        T: 'text-blue-800 dark:text-blue-400',
        U: 'text-green-800 dark:text-green-400',
        V: 'text-pink-800 dark:text-pink-400',
        W: 'text-yellow-800 dark:text-yellow-400',
        X: 'text-purple-800 dark:text-purple-400',
        Y: 'text-orange-800 dark:text-orange-400',
        Z: 'text-teal-800 dark:text-teal-400',
    };
    return colors[bank] || 'text-gray-600 dark:text-gray-300';
}

export function getNextKitSlot(kits: string[]): string | null {
    // Find the next available kit slot (A0-Z99)
    const banks = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const used = new Set(kits);
    for (let bank of banks) {
        for (let num = 0; num <= 99; num++) {
            const slot = bank + num;
            if (!used.has(slot)) return slot;
        }
    }
    return null;
}

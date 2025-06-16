export declare function toCapitalCase(str: string): string;
export declare function groupSamplesByVoice(files: string[]): {
    [voice: number]: string[];
};
export declare function inferVoiceTypeFromFilename(filename: string): string | null;
export declare function compareKitSlots(a: string, b: string): number;
export declare function getNextKitSlot(existing: string[]): string | null;
export declare function uniqueVoiceLabels(voiceNames: Record<number, string>): string[];
export declare function isValidKit(kit: string): boolean;
export declare function showBankAnchor(kit: string, idx: number, kits: string[]): boolean;

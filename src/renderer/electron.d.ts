export { };

declare global {
    interface Window {
        electronAPI: {
            scanSdCard: (sdCardPath: string) => Promise<string[]>;
            selectSdCard: () => Promise<string | null>;
            watchSdCard: (
                sdCardPath: string,
                callback: () => void
            ) => { close: () => void };
            getSetting: (key: string) => string | undefined; // Added getSetting
            setSetting: (key: string, value: any) => void;   // Added setSetting
        };
    }
}
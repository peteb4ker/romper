export {};

declare global {
  interface Window {
    romperEnv?: {
      ROMPER_SDCARD_PATH?: string;
      ROMPER_SQUARP_ARCHIVE_URL?: string;
    };
  }
}

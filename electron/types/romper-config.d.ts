export {};

declare global {
  interface Window {
    romperEnv?: {
      ROMPER_LOCAL_PATH?: string;
      ROMPER_SDCARD_PATH?: string;
      ROMPER_SQUARP_ARCHIVE_URL?: string;
    };
  }
}

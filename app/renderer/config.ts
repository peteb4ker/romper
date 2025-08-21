// Centralized Romper config for renderer and hooks
export interface RomperConfig {
  localStorePath?: string;
  sdCardPath?: string;
  squarpArchiveUrl: string;
  // Add more config options here as needed
}

function getConfigValue<T = string>(
  envKey: string,
  fallback?: T,
): T | undefined {
  // Check window.romperEnv (exposed from preload script)
  if (
    typeof window !== "undefined" &&
    (window as typeof window & { romperEnv?: Record<string, unknown> }).romperEnv?.[envKey]
  ) {
    return (window as typeof window & { romperEnv?: Record<string, unknown> }).romperEnv![envKey] as T;
  }

  // Fallback to process.env if available (for development)
  if (typeof process !== "undefined" && process.env?.[envKey]) {
    return process.env[envKey] as T;
  }

  return fallback;
}

let _config: null | RomperConfig = null;

function createConfig(): RomperConfig {
  const config = {
    localStorePath: getConfigValue("ROMPER_LOCAL_PATH"), // Target path for local store
    sdCardPath: getConfigValue("ROMPER_SDCARD_PATH"), // Source path for SD card
    squarpArchiveUrl:
      getConfigValue(
        "ROMPER_SQUARP_ARCHIVE_URL",
        "https://data.squarp.net/RampleSamplesV1-2.zip",
      ) || "https://data.squarp.net/RampleSamplesV1-2.zip",
  };

  return config;
}

export const config: RomperConfig = new Proxy({} as RomperConfig, {
  get(target, prop) {
    _config ??= createConfig();
    return _config[prop as keyof RomperConfig];
  },
});

// Centralized Romper config for renderer and hooks
export interface RomperConfig {
  squarpArchiveUrl: string;
  sdCardPath?: string;
  // Add more config options here as needed
}

function getConfigValue<T = string>(
  envKey: string,
  fallback?: T,
): T | undefined {
  // Check window.romperEnv (exposed from preload script)
  if (
    typeof window !== "undefined" &&
    (window as any).romperEnv &&
    (window as any).romperEnv[envKey]
  ) {
    return (window as any).romperEnv[envKey] as T;
  }

  // Fallback to process.env if available (for development)
  if (typeof process !== "undefined" && process.env && process.env[envKey]) {
    return process.env[envKey] as T;
  }

  return fallback;
}

let _config: RomperConfig | null = null;

function createConfig(): RomperConfig {
  const config = {
    squarpArchiveUrl:
      getConfigValue(
        "ROMPER_SQUARP_ARCHIVE_URL",
        "https://data.squarp.net/RampleSamplesV1-2.zip",
      ) || "https://data.squarp.net/RampleSamplesV1-2.zip",
    sdCardPath: getConfigValue("ROMPER_SDCARD_PATH"),
  };

  return config;
}

export const config: RomperConfig = new Proxy({} as RomperConfig, {
  get(target, prop) {
    if (_config === null) {
      _config = createConfig();
    }
    return _config[prop as keyof RomperConfig];
  },
});

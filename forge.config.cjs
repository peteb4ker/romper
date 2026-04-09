// Determine if macOS signing credentials are available
const hasMacSigningCreds = !!(
  process.env.APPLE_IDENTITY || process.env.APPLE_SIGNING_IDENTITY
);
const hasMacNotarizeCreds = !!(
  process.env.APPLE_ID &&
  process.env.APPLE_ID_PASSWORD &&
  process.env.APPLE_TEAM_ID
);

const config = {
  packagerConfig: {
    name: "Romper",
    executableName: "romper",
    appBundleId: "com.romper.samplemanager",
    appCategoryType: "public.app-category.music",
    icon: "./electron/resources/app-icon", // Don't include extension, Forge handles it
    out: "./electron/out",
    ignore: [
      // Ignore source files and dev dependencies
      "^/src",
      "^/app",
      "^/docs",
      "^/tests",
      "^/playwright-report",
      "^/test-results",
      "^/coverage",
      "^/\\.github",
      "^/\\.vscode",
      "^/\\.agent",
      "^/tasks",
      "^/scripts",
      "^/vite\\.",
      "^/tsconfig\\.",
      "^/tailwind\\.",
      "^/playwright\\.",
      "^/vitest\\.",
      "^/eslint\\.",
      "^/\\.eslintrc",
      "^/\\.gitignore",
      "^/\\.husky",
      "^/CLAUDE\\.md",
      "^/README\\.md",
      "^/.*\\.test\\.",
      "^/.*__tests__",
    ],
    extraResource: [
      // Include any additional resources needed at runtime
    ],
    // macOS code signing -- enabled only when APPLE_IDENTITY env var is set
    ...(hasMacSigningCreds
      ? {
          osxSign: {
            identity:
              process.env.APPLE_IDENTITY ||
              process.env.APPLE_SIGNING_IDENTITY,
            optionsForFile: () => ({
              hardenedRuntime: true,
              entitlements: "./electron/resources/entitlements.plist",
              "entitlements-inherit":
                "./electron/resources/entitlements.plist",
              "signature-flags": "library",
            }),
          },
        }
      : {}),
    // macOS notarization -- enabled only when Apple ID credentials are set
    ...(hasMacNotarizeCreds
      ? {
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: process.env.APPLE_TEAM_ID,
          },
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "Romper",
        authors: "Romper Development Team",
        description: "Sample manager for Squarp Rample Eurorack sampler",
        setupIcon: "./electron/resources/app-icon.ico",
        // Windows code signing via pfx file (when available)
        ...(process.env.WINDOWS_CERTIFICATE_FILE
          ? {
              certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
              certificatePassword:
                process.env.WINDOWS_CERTIFICATE_PASSWORD || "",
            }
          : {}),
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux"],
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          maintainer: "Romper Development Team",
          homepage: "https://github.com/peteb4ker/romper",
          description: "Cross-platform sample manager for Squarp Rample",
          categories: ["Audio", "AudioVideo"],
          section: "sound",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
      config: {
        options: {
          maintainer: "Romper Development Team",
          homepage: "https://github.com/peteb4ker/romper",
          description: "Cross-platform sample manager for Squarp Rample",
          categories: ["Audio", "AudioVideo"],
        },
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "Romper",
        title: "Romper ${version}",
        format: "ULFO",
        icon: "./electron/resources/app-icon.icns",
      },
    },
  ],
  plugins: [],
};

module.exports = config;

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
    // macOS signing + notarization are handled out-of-band by
    // indygreg/apple-code-sign-action in .github/workflows/release.yml
    // (rcodesign + ASC API key). Forge produces an unsigned .app; the
    // workflow signs it, then runs the DMG/zip makers around it, then
    // notarizes+staples the DMG.
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

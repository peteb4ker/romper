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
    // Code signing configuration framework (requires certificates)
    // Uncomment and configure when Apple Developer certificates are available
    // osxSign: {
    //   identity: "Developer ID Application: Your Name (TEAM_ID)",
    //   hardened_runtime: true,
    //   entitlements: "./electron/resources/entitlements.plist",
    //   "entitlements-inherit": "./electron/resources/entitlements.plist",
    //   "signature-flags": "library"
    // },
    // osxNotarize: {
    //   appleId: "your-apple-id@example.com",
    //   appleIdPassword: "@env:APPLE_ID_PASSWORD", // App-specific password
    //   teamId: "YOUR_TEAM_ID"
    // }
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
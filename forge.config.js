module.exports = {
  packagerConfig: {
    name: "Romper Sample Manager",
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
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "RomperSampleManager",
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
      config: {
        name: "Romper Sample Manager",
        title: "Romper Sample Manager ${version}",
        format: "ULFO",
        background: "./electron/resources/dmg-background.png", // Optional, can be added later
        icon: "./electron/resources/app-icon.icns",
      },
    },
  ],
  plugins: [],
};

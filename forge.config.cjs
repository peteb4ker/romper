const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const config = {
  packagerConfig: {
    name: "Romper",
    executableName: "romper",
    appBundleId: "com.romper.samplemanager",
    appCategoryType: "public.app-category.music",
    icon: "./electron/resources/app-icon", // Don't include extension, Forge handles it
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
        // Branded DMG window: dark background with a drag-to-install arrow.
        // The icon coordinates below MUST stay in sync with the layout baked
        // into scripts/generate-dmg-background.mjs (APP_X / APPS_X / ICON_Y).
        // appdmg auto-detects dmg-background@2x.png for retina displays.
        background: "./electron/resources/dmg-background.png",
        iconSize: 100,
        additionalDMGOptions: {
          window: { size: { width: 540, height: 380 } },
        },
        contents: (opts) => [
          { x: 140, y: 205, type: "file", path: opts.appPath },
          { x: 400, y: 205, type: "link", path: "/Applications" },
        ],
      },
    },
  ],
  plugins: [
    // Flip Electron fuses on the packaged binary to shrink the attack surface.
    // ELECTRON_RUN_AS_NODE, the Node CLI inspect flags, and NODE_OPTIONS are
    // disabled so the shipped binary cannot be repurposed as a general Node
    // runtime or attached to with a debugger.
    //
    // The asar-integrity fuses (OnlyLoadAppFromAsar /
    // EnableEmbeddedAsarIntegrityValidation) are intentionally left disabled:
    // this project does not currently package with asar, and enabling it has
    // native-module (better-sqlite3) implications that are out of scope here.
    //
    // Fuses are flipped during forge packaging, before the out-of-band macOS
    // signing step in .github/workflows/release.yml, so the signature covers
    // the fused binary.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
      [FuseV1Options.RunAsNode]: false,
    }),
  ],
};

module.exports = config;

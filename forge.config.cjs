const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

const { ignorePackagedPath } = require("./scripts/packaged-files.cjs");
const {
  pruneSqlitePrebuilds,
} = require("./scripts/prune-sqlite-prebuilds.cjs");
const { version } = require("./package.json");

// The mounted installer's volume name and Finder window title (#705). The
// makers don't fill in placeholders, so build it from package.json here.
// appdmg breaks the background alias for volume names over 27 characters.
const DMG_TITLE = `Romper ${version}`;

const config = {
  packagerConfig: {
    name: "Romper",
    executableName: "romper",
    appBundleId: "com.romper.samplemanager",
    appCategoryType: "public.app-category.music",
    icon: "./electron/resources/app-icon", // Don't include extension, Forge handles it
    // An allowlist: only the build output, package.json and the production
    // node_modules ship (#464). See scripts/packaged-files.cjs.
    ignore: ignorePackagedPath,
    extraResource: [
      // Include any additional resources needed at runtime
    ],
    // macOS signing + notarization are handled out-of-band by
    // indygreg/apple-code-sign-action in .github/workflows/release.yml
    // (rcodesign + ASC API key). Forge produces an unsigned .app; the
    // workflow signs it, then runs the DMG/zip makers around it, then
    // notarizes+staples the DMG.
  },
  // Rebuild no native modules for Electron. better-sqlite3 (the only one)
  // ships N-API prebuilds that load in any Electron version, and compiling it
  // needs a C++ toolchain node-gyp can find, which the Windows release runner
  // (Visual Studio 2026) didn't provide to Forge's bundled node-gyp.
  rebuildConfig: { onlyModules: [] },
  hooks: {
    // better-sqlite3's npm package carries a prebuild for every platform;
    // ship only the target's (#694). See scripts/prune-sqlite-prebuilds.cjs.
    packageAfterPrune: (_config, buildPath, _electron, platform, arch) => {
      pruneSqlitePrebuilds(buildPath, platform, arch);
    },
  },
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
        // `name` is the .dmg file name (Romper.dmg); `title` is the volume.
        title: DMG_TITLE,
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

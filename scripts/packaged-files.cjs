// What a packaged app's folder (`resources/app`) ships (#464).
//
// The app loads its build output, its package.json and the production
// node_modules at runtime, and nothing else from its own folder: the main
// bundle reads its migrations and menu icons from beside itself
// (dist/electron/main), and the window loads dist/electron/preload and
// dist/renderer. Forge's `packagerConfig.ignore` used to list what to leave
// out, so every new file in the repo shipped (aidlc-docs/, BACKLOG.md, a
// local .env.local, the TypeScript sources). This lists what to keep.
//
// Icons, entitlements and the DMG background are read from the repo at
// package and sign time, so they don't need to be in the app folder.

/** Top-level entries of the packaged app folder */
const SHIPPED_ENTRIES = ["LICENSE", "dist", "node_modules", "package.json"];

/** Paths the app folder keeps, as packager sees them ("/dist/...") */
const KEEP = [
  /^\/package\.json$/,
  /^\/LICENSE$/,
  /^\/dist\/electron\/(main|preload)(\/|$)/,
  /^\/dist\/renderer(\/|$)/,
  /^\/node_modules(\/|$)/,
];

/** Folders that hold kept paths, so packager must walk into them */
const PARENTS = new Set(["", "/dist", "/dist/electron"]);

// Left out of the kept paths:
// - @electron/packager's own defaults, which it skips when `ignore` is a
//   function (packager prunes devDependencies out of node_modules itself)
// - hidden files and folders in node_modules: npm's .bin and hidden
//   lockfile, the Vite and Vitest caches, and the repo tooling some
//   packages publish (.yarn, .github, .travis.yml)
// - the SQLite sources and build files better-sqlite3 carries for
//   compiling from source; the app loads its prebuild (see
//   prune-sqlite-prebuilds.cjs)
const LEAVE_OUT = [
  /\.o(bj)?$/,
  /\/node_gyp_bins(\/|$)/,
  /^\/node_modules\/(?:[^/]+\/)*\./,
  /^\/node_modules\/better-sqlite3\/(binding\.gyp$|build(\/|$)|deps(\/|$)|src(\/|$))/,
];

/**
 * Forge's `packagerConfig.ignore`: true for a path the packaged app leaves
 * out. `file` is relative to the project, with a leading slash and forward
 * slashes ("" is the project folder itself).
 * @param {string} file
 */
function ignorePackagedPath(file) {
  if (PARENTS.has(file)) return false;
  if (LEAVE_OUT.some((pattern) => pattern.test(file))) return true;
  return !KEEP.some((pattern) => pattern.test(file));
}

module.exports = { ignorePackagedPath, SHIPPED_ENTRIES };

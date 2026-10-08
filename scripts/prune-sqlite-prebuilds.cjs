// Keep only the target's better-sqlite3 binary in a packaged app (#694).
//
// better-sqlite3 13 publishes an N-API prebuild for every platform it
// supports in its npm package (`prebuilds/<target>.node`), and its loader
// (`lib/binding.js`) requires `prebuilds/<platform>-<arch>.node`, or
// `linuxmusl-<arch>.node` on musl. Packaging copies the whole folder, so a
// Linux x64 package shipped the arm64 binaries too, and the rpm maker's
// `strip` failed on them.
//
// Forge runs this from its `packageAfterPrune` hook, which knows the target
// platform and arch (a `packagerConfig.ignore` pattern only sees paths, so
// it would have to guess the target from the build machine). Electron runs
// only on glibc Linux, so the musl binaries are never loaded either.

const fs = require("node:fs");
const path = require("node:path");

const PREBUILDS_DIR = path.join("node_modules", "better-sqlite3", "prebuilds");

/**
 * Delete every better-sqlite3 prebuild in `buildPath` except the one the
 * app loads on `platform`-`arch`. Returns the names it removed.
 *
 * Throws if the folder exists but has no binary for the target, so a
 * package that couldn't open its database is never made.
 * @param {string} buildPath the packaged app's folder
 * @param {string} platform
 * @param {string} arch
 * @returns {string[]}
 */
function pruneSqlitePrebuilds(buildPath, platform, arch) {
  const dir = path.join(buildPath, PREBUILDS_DIR);
  if (!fs.existsSync(dir)) return [];

  const keep = `${platform}-${arch}.node`;
  const files = fs.readdirSync(dir);
  if (!files.includes(keep)) {
    throw new Error(
      `better-sqlite3 has no prebuild for ${platform}-${arch} in ${dir} (found: ${files.join(", ") || "none"})`,
    );
  }

  const removed = files.filter((file) => file !== keep);
  for (const file of removed) {
    fs.rmSync(path.join(dir, file), { force: true, recursive: true });
  }
  return removed;
}

module.exports = { PREBUILDS_DIR, pruneSqlitePrebuilds };

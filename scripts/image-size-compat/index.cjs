/**
 * The image-size 0.x/1.x API (`sizeOf(path, callback)`) on top of the
 * patched image-size 2.x (#700).
 *
 * appdmg 0.6.6, the latest, requires `image-size@^0.7.4`, and every
 * image-size before 2.0.3 has a denial-of-service advisory
 * (GHSA-w3rx-r6r6-pgpr). Version 2 exports `{ imageSize }`, which takes
 * only a buffer, so an `overrides` entry pointing appdmg straight at it
 * fails with "sizeOf is not a function". package.json's
 * `"image-size": "$image-size"` override points appdmg here instead.
 *
 * appdmg calls it once, to read the size of the DMG background
 * (electron/resources/dmg-background.png). Drop this package and the
 * override once appdmg moves to image-size 2.
 */
const fs = require("node:fs");
const { imageSize } = require("image-size-v2");

function sizeOf(input, callback) {
  if (typeof callback !== "function") {
    return imageSize(
      typeof input === "string" ? fs.readFileSync(input) : input,
    );
  }
  fs.readFile(input, (readError, buffer) => {
    if (readError) {
      callback(readError);
      return;
    }
    let size;
    try {
      size = imageSize(buffer);
    } catch (error) {
      callback(error);
      return;
    }
    callback(null, size);
  });
}

module.exports = sizeOf;

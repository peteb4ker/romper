// @vitest-environment node
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Size = { height: number; type?: string; width: number };
type SizeOf = {
  (input: string | Uint8Array): Size;
  (input: string, callback: (error: Error | null, size?: Size) => void): void;
};

const require = createRequire(import.meta.url);
const sizeOf = require("../image-size-compat/index.cjs") as SizeOf;
const BACKGROUND = path.resolve(
  __dirname,
  "../../electron/resources/dmg-background.png",
);

function sizeOfAsync(input: string) {
  return new Promise<Size | undefined>((resolve, reject) => {
    sizeOf(input, (error, size) => (error ? reject(error) : resolve(size)));
  });
}

describe("[Q-05] image-size compat for appdmg (#700)", () => {
  it("reads the DMG background's size through appdmg's callback API", async () => {
    await expect(sizeOfAsync(BACKGROUND)).resolves.toMatchObject({
      height: 380,
      type: "png",
      width: 540,
    });
  });

  // appdmg is an optional, macOS-only dependency of the DMG maker
  it.skipIf(process.platform !== "darwin")(
    "is what appdmg loads as image-size",
    () => {
      const appdmg = path.dirname(require.resolve("appdmg/package.json"));
      const resolved = require.resolve("image-size", { paths: [appdmg] });
      expect(fs.realpathSync(resolved)).toBe(
        fs.realpathSync(require.resolve("../image-size-compat/index.cjs")),
      );
    },
  );

  it("answers synchronously without a callback", () => {
    expect(sizeOf(BACKGROUND)).toMatchObject({ height: 380, width: 540 });
    expect(sizeOf(fs.readFileSync(BACKGROUND))).toMatchObject({ width: 540 });
  });

  it("passes a missing file's error to the callback", async () => {
    await expect(sizeOfAsync("/no/such/background.png")).rejects.toThrow(
      /ENOENT/,
    );
  });

  it("passes an unreadable image's error to the callback", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "image-size-compat-"));
    const notAnImage = path.join(dir, "background.png");
    fs.writeFileSync(notAnImage, "not an image");
    try {
      await expect(sizeOfAsync(notAnImage)).rejects.toThrow(/unsupported/);
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });
});

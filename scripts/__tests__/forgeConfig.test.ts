// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };
const config = require("../../forge.config.cjs") as {
  makers: { config?: Record<string, unknown>; name: string }[];
};

const dmgConfig = config.makers.find(
  (maker) => maker.name === "@electron-forge/maker-dmg",
)?.config;

describe("[Q-05] forge.config.cjs DMG maker", () => {
  it("titles the installer volume with the package version (#705)", () => {
    expect(dmgConfig?.title).toBe(`Romper ${version}`);
    expect(dmgConfig?.title).not.toContain("${");
  });

  it("keeps the volume name within appdmg's 27-character limit", () => {
    expect(String(dmgConfig?.title).length).toBeLessThanOrEqual(27);
  });

  it("keeps the DMG file name unversioned", () => {
    expect(dmgConfig?.name).toBe("Romper");
  });
});

// @vitest-environment node
import path from "node:path";
import { describe, expect, it } from "vitest";

import { smokeEnv } from "../smoke-packaged-app.mjs";

// #626: the packaged-app smoke test launched the app without its own
// settings folder, so a local run wrote the installed app's settings.
describe("[Q-07] packaged-app smoke test environment", () => {
  const root = path.join("tmp", "romper-smoke-abc");

  it("gives the app its own settings folder inside the run's temp folder", () => {
    const env = smokeEnv({}, root);

    expect(env.ROMPER_USER_DATA_DIR).toBe(path.join(root, "user-data"));
    expect(env.ROMPER_HEADLESS).toBe("true");
    expect(env.ROMPER_LOCAL_PATH).toBe(path.join(root, "store"));
    expect(env.ROMPER_SDCARD_PATH).toBe(path.join(root, "card"));
  });

  it("replaces a settings folder or headless flag inherited from the caller", () => {
    const env = smokeEnv(
      {
        PATH: "/usr/bin",
        ROMPER_HEADLESS: "false",
        ROMPER_USER_DATA_DIR: "/installed/app/settings",
      },
      root,
    );

    expect(env.ROMPER_USER_DATA_DIR).toBe(path.join(root, "user-data"));
    expect(env.ROMPER_HEADLESS).toBe("true");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("keeps everything the app writes under the run's temp folder", () => {
    const env = smokeEnv({}, root);

    for (const key of [
      "ROMPER_LOCAL_PATH",
      "ROMPER_SDCARD_PATH",
      "ROMPER_USER_DATA_DIR",
    ] as const) {
      expect(path.relative(root, env[key]!)).not.toMatch(/^\.\./);
    }
  });
});

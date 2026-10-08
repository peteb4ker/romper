// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { appEnv } from "../e2e-app-env";

describe("[Q-07] the environment e2e specs launch the app with", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes on the runner's variables, overridden by the spec's", () => {
    vi.stubEnv("ROMPER_HEADLESS", "true");
    vi.stubEnv("ROMPER_SDCARD_PATH", "/runner/card");

    const env = appEnv({ ROMPER_SDCARD_PATH: "/spec/card" });

    expect(env.ROMPER_HEADLESS).toBe("true");
    expect(env.ROMPER_SDCARD_PATH).toBe("/spec/card");
  });

  it("leaves out unset variables, which a launch can't take", () => {
    vi.stubEnv("ROMPER_LOCAL_PATH", undefined);

    expect(Object.values(appEnv())).not.toContain(undefined);
    expect(appEnv()).not.toHaveProperty("ROMPER_LOCAL_PATH");
  });

  it("leaves out the variables a spec omits", () => {
    vi.stubEnv("ROMPER_LOCAL_PATH", "/runner/store");

    const env = appEnv(
      { ROMPER_USER_DATA_DIR: "/spec/user" },
      { omit: ["ROMPER_LOCAL_PATH"] },
    );

    expect(env).not.toHaveProperty("ROMPER_LOCAL_PATH");
    expect(env.ROMPER_USER_DATA_DIR).toBe("/spec/user");
  });
});

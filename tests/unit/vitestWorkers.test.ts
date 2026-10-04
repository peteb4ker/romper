import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { testWorkerCount } from "../../vitest.workers";

// RE-58: a fixed 10 workers timed out whenever the machine was busy
describe("testWorkerCount", () => {
  // `override` defaults to ROMPER_TEST_WORKERS, so an undefined argument
  // reads the shell's value. Clear it, or the no-override cases fail for
  // anyone who sets it (#599).
  beforeEach(() => {
    vi.stubEnv("ROMPER_TEST_WORKERS", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the free cores, keeping two for the work beside the tests", () => {
    expect(testWorkerCount(12, 0, undefined)).toBe(10);
    expect(testWorkerCount(12, 5.5, undefined)).toBe(6);
  });

  it("drops to one worker on a saturated machine", () => {
    expect(testWorkerCount(12, 30, undefined)).toBe(1);
  });

  it("never asks for more than 10, however many cores there are", () => {
    expect(testWorkerCount(32, 0, undefined)).toBe(10);
  });

  it("takes an explicit ROMPER_TEST_WORKERS", () => {
    expect(testWorkerCount(12, 30, "6")).toBe(6);
    expect(testWorkerCount(12, 0, "nonsense")).toBe(10);
    expect(testWorkerCount(12, 0, "0")).toBe(10);
  });

  it("reads ROMPER_TEST_WORKERS from the environment by default", () => {
    vi.stubEnv("ROMPER_TEST_WORKERS", "3");
    expect(testWorkerCount(12, 0)).toBe(3);
  });
});

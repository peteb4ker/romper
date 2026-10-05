// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  earlierAttemptErrors,
  recordAttemptErrors,
} from "../e2e-attempt-errors";

describe("[Q-07] e2e error guard across retries (#659)", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-guard-"));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { force: true, recursive: true });
  });

  it("gives a retry the errors its earlier attempt reported", () => {
    recordAttemptErrors(outputDir, "test-1", ["[renderer] boom"]);

    expect(earlierAttemptErrors(outputDir, "test-1")).toEqual([
      "[renderer] boom",
    ]);
    expect(earlierAttemptErrors(outputDir, "test-2")).toEqual([]);
  });

  it("has nothing for a test whose earlier attempt reported none", () => {
    expect(earlierAttemptErrors(outputDir, "test-1")).toEqual([]);
  });
});

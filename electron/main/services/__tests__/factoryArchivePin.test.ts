import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SQUARP_FACTORY_SAMPLES_SHA256,
  SQUARP_FACTORY_SAMPLES_URL,
} from "../archiveService";

// The validation harness records the archive it checked in
// tests/validation/factory-archive.json; the app pins the same one (RE-24).
describe("factory archive pin", () => {
  const record = JSON.parse(
    readFileSync(
      path.resolve(
        __dirname,
        "../../../../tests/validation/factory-archive.json",
      ),
      "utf8",
    ),
  ) as { sha256: string; url: string };

  it("matches the archive the validation harness checked", () => {
    expect(SQUARP_FACTORY_SAMPLES_URL).toBe(record.url);
    expect(SQUARP_FACTORY_SAMPLES_SHA256).toBe(record.sha256);
  });
});

import fs from "fs";
import path from "path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { readRampleBin, writeRampleBin } from "../rampleBin";

describe("rampleBin", () => {
  const testFile = path.join(
    __dirname,
    "../../../tests/fixtures",
    "rample.bin",
  );
  const tempFile = path.join(
    __dirname,
    "../../../tests/fixtures",
    "rample.bin.tmp",
  );

  beforeAll(() => {
    if (!fs.existsSync(path.dirname(testFile))) {
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  });

  it("reads the rample.bin file as a Buffer", () => {
    const buf = readRampleBin(testFile);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("writes a Buffer to rample.bin", () => {
    const original = readRampleBin(testFile);
    const modified = Buffer.from(original);
    // Flip the first byte for test
    modified[0] = (modified[0] + 1) % 256;
    writeRampleBin(tempFile, modified);
    const reread = readRampleBin(tempFile);
    expect(reread[0]).toBe(modified[0]);
    expect(reread.length).toBe(original.length);
  });
});

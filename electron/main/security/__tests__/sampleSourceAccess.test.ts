import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(),
}));
vi.mock("../../db/operations/sampleSourceQueries.js", () => ({
  isSourcePathReferenced: vi.fn(),
}));

import { isSourcePathReferenced } from "../../db/operations/sampleSourceQueries.js";
import { getKitSamples } from "../../db/romperDbCoreORM.js";
import { pathAccess } from "../pathAccess";
import {
  checkSampleSourceAccess,
  rememberKitSampleSources,
} from "../sampleSourceAccess";

describe("sampleSourceAccess (RE-03)", () => {
  let tmp: string;
  let store: string;
  let library: string;
  let settings: Record<string, unknown>;
  const savedLocal = process.env.ROMPER_LOCAL_PATH;

  function sample(source_path: string) {
    return { filename: path.basename(source_path), source_path } as never;
  }

  beforeEach(() => {
    delete process.env.ROMPER_LOCAL_PATH;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "romper-sample-access-"));
    store = path.join(tmp, "store");
    library = path.join(tmp, "library");
    fs.mkdirSync(path.join(store, ".romperdb"), { recursive: true });
    fs.writeFileSync(path.join(store, ".romperdb", "romper.sqlite"), "");
    fs.mkdirSync(library);
    settings = { localStorePath: store };
    pathAccess.reset();
    pathAccess.useSettings(settings);
    vi.mocked(isSourcePathReferenced).mockReturnValue({
      data: false,
      success: true,
    });
    vi.mocked(getKitSamples).mockReturnValue({ data: [], success: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { force: true, recursive: true });
    pathAccess.reset();
    vi.clearAllMocks();
    if (savedLocal === undefined) delete process.env.ROMPER_LOCAL_PATH;
    else process.env.ROMPER_LOCAL_PATH = savedLocal;
  });

  it("allows files inside the store without a database lookup", () => {
    const result = checkSampleSourceAccess(
      settings,
      path.join(store, "A0", "1 kick.wav"),
    );
    expect(result.ok).toBe(true);
    expect(isSourcePathReferenced).not.toHaveBeenCalled();
  });

  it("allows a file the user dropped this session", () => {
    const dropped = path.join(library, "snare.wav");
    expect(checkSampleSourceAccess(settings, dropped).ok).toBe(false);
    pathAccess.grantRead(dropped);
    expect(checkSampleSourceAccess(settings, dropped).ok).toBe(true);
  });

  it("allows a file the store already references (added in an earlier session)", () => {
    const referenced = path.join(library, "hat.wav");
    vi.mocked(isSourcePathReferenced).mockReturnValue({
      data: true,
      success: true,
    });
    expect(checkSampleSourceAccess(settings, referenced).ok).toBe(true);
    // [Q-01] One LIMIT 1 lookup for this path, not a load of every sample
    expect(isSourcePathReferenced).toHaveBeenCalledWith(
      path.join(store, ".romperdb"),
      [referenced],
    );
  });

  it("looks up both the path as given and its resolved form", () => {
    const given = `${library}${path.sep}x${path.sep}..${path.sep}hat.wav`;
    checkSampleSourceAccess(settings, given);
    expect(isSourcePathReferenced).toHaveBeenCalledWith(
      path.join(store, ".romperdb"),
      [given, path.join(library, "hat.wav")],
    );
  });

  it("denies anything else", () => {
    const result = checkSampleSourceAccess(settings, "/etc/passwd");
    expect(result.ok).toBe(false);
    expect(checkSampleSourceAccess(settings, "relative.wav").ok).toBe(false);
    expect(checkSampleSourceAccess(settings, undefined).ok).toBe(false);
  });

  it("doesn't consult (or create) a database that doesn't exist", () => {
    fs.rmSync(path.join(store, ".romperdb"), { force: true, recursive: true });
    expect(checkSampleSourceAccess(settings, "/etc/passwd").ok).toBe(false);
    expect(isSourcePathReferenced).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(store, ".romperdb"))).toBe(false);
  });

  it("denies when the database lookup fails", () => {
    vi.mocked(isSourcePathReferenced).mockImplementation(() => {
      throw new Error("locked");
    });
    expect(checkSampleSourceAccess(settings, "/etc/passwd").ok).toBe(false);
    vi.mocked(isSourcePathReferenced).mockReturnValue({
      error: "locked",
      success: false,
    });
    expect(checkSampleSourceAccess(settings, "/etc/passwd").ok).toBe(false);
  });

  it("uses the ROMPER_LOCAL_PATH store when set", () => {
    const envStore = path.join(tmp, "env-store");
    fs.mkdirSync(path.join(envStore, ".romperdb"), { recursive: true });
    fs.writeFileSync(path.join(envStore, ".romperdb", "romper.sqlite"), "");
    process.env.ROMPER_LOCAL_PATH = envStore;
    checkSampleSourceAccess({}, "/etc/passwd");
    expect(isSourcePathReferenced).toHaveBeenCalledWith(
      path.join(envStore, ".romperdb"),
      ["/etc/passwd"],
    );
  });

  describe("rememberKitSampleSources", () => {
    it("lets undo re-add a sample after it leaves the database", () => {
      const external = path.join(library, "tom.wav");
      vi.mocked(getKitSamples).mockReturnValue({
        data: [sample(external)],
        success: true,
      });

      rememberKitSampleSources(settings, "A0", "B1", undefined, "");

      expect(getKitSamples).toHaveBeenCalledTimes(2);
      expect(getKitSamples).toHaveBeenCalledWith(
        path.join(store, ".romperdb"),
        "A0",
      );
      // The sample has since been deleted: the database no longer has it.
      expect(checkSampleSourceAccess(settings, external).ok).toBe(true);
      // Remembering grants read only.
      expect(pathAccess.check(external, "write").ok).toBe(false);
    });

    it("does nothing without a configured store", () => {
      rememberKitSampleSources({}, "A0");
      expect(getKitSamples).not.toHaveBeenCalled();
    });

    it("ignores lookup failures", () => {
      vi.mocked(getKitSamples).mockImplementation(() => {
        throw new Error("locked");
      });
      expect(() => rememberKitSampleSources(settings, "A0")).not.toThrow();
    });
  });
});

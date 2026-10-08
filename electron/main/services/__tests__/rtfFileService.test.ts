import * as fs from "node:fs";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("node:path", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:path")>()),
);

import {
  CARD_NOT_RESPONDING_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  CardNotRespondingError,
  cardWatchdogSettings,
} from "../cardWatchdog.js";
import {
  bankNameError,
  isBankLetter,
  rtfFileService,
} from "../rtfFileService.js";

const mockFs = vi.mocked(fs, true);
// The card root's listing: plain names, readdir's first overload
const mockReaddir = mockFs.promises.readdir as unknown as Mock<
  (dirPath: string) => Promise<string[]>
>;
const mockPath = vi.mocked(path);

describe("[UC-12] [UC-34] rtfFileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.join.mockImplementation((...args: string[]) => args.join("/"));
    mockFs.promises.unlink.mockResolvedValue(undefined);
    mockFs.promises.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("writeRtfFile", () => {
    it("should remove existing RTF files and write a new one", async () => {
      mockReaddir.mockResolvedValue(["A - Old Artist.rtf"]);

      await rtfFileService.writeRtfFile("/store", "A", "New Artist");

      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        "/store/A - Old Artist.rtf",
      );
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        "/store/A - New Artist.rtf",
        "{\\rtf1}",
        "utf-8",
      );
    });

    it("should write RTF file when no existing file", async () => {
      mockReaddir.mockResolvedValue([]);

      await rtfFileService.writeRtfFile("/store", "B", "My Artist");

      expect(mockFs.promises.unlink).not.toHaveBeenCalled();
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        "/store/B - My Artist.rtf",
        "{\\rtf1}",
        "utf-8",
      );
    });
  });

  describe("removeRtfFile", () => {
    it("should remove matching RTF file for bank letter", async () => {
      mockReaddir.mockResolvedValue(["A - Artist.rtf", "B - Other.rtf"]);

      await rtfFileService.removeRtfFile("/store", "A");

      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        "/store/A - Artist.rtf",
      );
      expect(mockFs.promises.unlink).toHaveBeenCalledTimes(1);
    });

    it("should not remove files for other bank letters", async () => {
      mockReaddir.mockResolvedValue(["B - Other.rtf"]);

      await rtfFileService.removeRtfFile("/store", "A");

      expect(mockFs.promises.unlink).not.toHaveBeenCalled();
    });
  });

  describe("writeAllBankRtfFiles", () => {
    it("should write RTF files for banks with artist names", async () => {
      mockReaddir.mockResolvedValue([]);

      const banks = [
        {
          artist: "Artist A",
          letter: "A",
          rtf_filename: null,
          scanned_at: null,
        },
        { artist: null, letter: "B", rtf_filename: null, scanned_at: null },
        {
          artist: "Artist C",
          letter: "C",
          rtf_filename: null,
          scanned_at: null,
        },
      ];

      const written = await rtfFileService.writeAllBankRtfFiles("/sd", banks);

      expect(written).toBe(2);
      expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(2);
    });

    it("should return 0 when no banks have artists", async () => {
      const banks = [
        { artist: null, letter: "A", rtf_filename: null, scanned_at: null },
      ];

      const written = await rtfFileService.writeAllBankRtfFiles("/sd", banks);

      expect(written).toBe(0);
      expect(mockFs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
  // #656: the card's driver can stop responding. A synchronous call would
  // block the main process, so each card operation is asynchronous and the
  // watchdog gives up on one that never finishes.
  describe("[Q-01] a card that stops responding (#656)", () => {
    afterEach(() => {
      cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    });

    it("fails the write when a bank name file is never written", async () => {
      mockReaddir.mockResolvedValue([]);
      mockFs.promises.writeFile.mockReturnValue(
        new Promise<void>(() => undefined),
      );
      cardWatchdogSettings.timeoutMs = 20;

      await expect(
        rtfFileService.writeAllBankRtfFiles("/sd", [
          {
            artist: "ALWIS",
            letter: "A",
            rtf_filename: null,
            scanned_at: null,
          },
          {
            artist: "Other",
            letter: "B",
            rtf_filename: null,
            scanned_at: null,
          },
        ]),
      ).rejects.toThrow(CardNotRespondingError);
      // It gave up on the first bank and didn't start the next
      expect(mockFs.promises.writeFile).toHaveBeenCalledTimes(1);
    });

    it("fails the write when an old name file is never removed", async () => {
      mockReaddir.mockResolvedValue(["A - Old.rtf"]);
      mockFs.promises.unlink.mockReturnValue(
        new Promise<void>(() => undefined),
      );
      cardWatchdogSettings.timeoutMs = 20;

      await expect(
        rtfFileService.writeRtfFile("/sd", "A", "New"),
      ).rejects.toThrow(CARD_NOT_RESPONDING_MESSAGE);
      expect(mockFs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("fails the write when the card root is never listed", async () => {
      mockReaddir.mockReturnValue(new Promise<never>(() => undefined));
      cardWatchdogSettings.timeoutMs = 20;

      await expect(rtfFileService.removeRtfFile("/sd", "A")).rejects.toThrow(
        CardNotRespondingError,
      );
    });

    it("touches the card only through fs.promises", async () => {
      mockReaddir.mockResolvedValue(["A - Old.rtf"]);

      await rtfFileService.writeAllBankRtfFiles("/sd", [
        { artist: "ALWIS", letter: "A", rtf_filename: null, scanned_at: null },
      ]);

      expect(mockFs.readdirSync).not.toHaveBeenCalled();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockFs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe("validation (RE-23)", () => {
    it.each([
      "AC/DC",
      "..\\up",
      "../../escape",
      'Say "hi"',
      "a:b",
      "tab\there",
    ])("refuses %j as a bank name", async (name) => {
      expect(bankNameError(name)).not.toBeNull();
      await expect(
        rtfFileService.writeRtfFile("/store", "A", name),
      ).rejects.toThrow();
      expect(mockFs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("accepts ordinary names, including dots and accents", () => {
      expect(bankNameError("Dr. Octagon")).toBeNull();
      expect(bankNameError("Björk & Co")).toBeNull();
    });

    it("refuses a bank letter that isn't A to Z", async () => {
      expect(isBankLetter("A")).toBe(true);
      for (const letter of ["a", "AA", ".*", "", "Ä"]) {
        expect(isBankLetter(letter)).toBe(false);
        await expect(
          rtfFileService.removeRtfFile("/store", letter),
        ).rejects.toThrow();
      }
      expect(mockFs.promises.unlink).not.toHaveBeenCalled();
    });

    it("matches files by the shared bank name file pattern, either case", async () => {
      mockReaddir.mockResolvedValue([
        "a - lower.rtf",
        "AB - Other.rtf",
        "A - .txt",
      ]);

      await rtfFileService.removeRtfFile("/store", "A");

      expect(mockFs.promises.unlink).toHaveBeenCalledTimes(1);
      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        "/store/a - lower.rtf",
      );
    });

    it("skips stored names that can't be written when writing all banks", async () => {
      mockReaddir.mockResolvedValue([]);

      const written = await rtfFileService.writeAllBankRtfFiles("/sd", [
        { artist: "AC/DC", letter: "A", rtf_filename: null, scanned_at: null },
        { artist: "ALWIS", letter: "B", rtf_filename: null, scanned_at: null },
      ]);

      expect(written).toBe(1);
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        "/sd/B - ALWIS.rtf",
        "{\\rtf1}",
        "utf-8",
      );
    });
  });
});

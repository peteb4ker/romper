import type {
  RampleKitSaveFound,
  RampleKitSaveView,
} from "@romper/shared/rampleKitSaveView";
import type { RampleFirmwareGuess } from "@romper/shared/rampleSave";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatTakenAt,
  RAMPLE_KIT_FIELDS,
  RAMPLE_VOICE_FIELDS,
} from "../rampleSaveFields";
import RampleSavePanel from "../RampleSavePanel";
import { RAMPLE_SAVE_FIELD_LABELS, RAMPLE_SAVE_TEXT } from "../rampleSaveText";

const TAKEN_AT = "2026-10-09T04:12:58.000Z";
const COPY = { folderName: "2026-10-09T04-12-58Z", takenAt: TAKEN_AT };

const firmware: RampleFirmwareGuess = {
  atLeast: "2.00",
  before: "3.00",
  candidates: ["2.00"],
  evidence: [],
  inferred: true,
  label: "2.00 (inferred from settings.rpl's keys)",
};

const four = <T,>(value: T): T[] => [value, value, value, value];

function foundView(
  overrides: Partial<RampleKitSaveFound> = {},
): RampleKitSaveFound {
  return {
    copy: COPY,
    fileName: "L1.rpl",
    firmware,
    kitName: "L1",
    missingKeys: [],
    otherValues: [],
    status: "found",
    values: {
      assignments: four({ param: 9, voice: 0 }),
      bitcrush: four(127),
      env: four(127),
      filter: [189, 127, 127, 127],
      freeze: four(127),
      layerModes: four(1),
      length: four(254),
      level: [42, 127, 127, 127],
      loop: [0, 127, 127, 127],
      muteGroup: [
        [false, true, false, false],
        four(false),
        four(false),
        four(false),
      ],
      pitch: four(127),
      selectedLayer: [1, 0, 3, 2],
      start: four(0),
    },
    ...overrides,
  };
}

async function openPanel(kitName = "L1") {
  const user = userEvent.setup();
  const view = render(<RampleSavePanel kitName={kitName} />);
  await user.click(
    screen.getByRole("button", { name: RAMPLE_SAVE_TEXT.title }),
  );
  return { user, ...view };
}

function serve(view: RampleKitSaveView) {
  vi.mocked(globalThis.electronAPI.getKitRampleSave).mockResolvedValue({
    data: view,
    success: true,
  });
}

describe("[UC-08] [Q-08] the kit editor's On the Rample section (#800)", () => {
  beforeEach(() => {
    vi.mocked(globalThis.electronAPI.getKitRampleSave).mockReset();
    serve(foundView());
  });

  describe("[Q-06] collapsed by default, and opened from the keyboard", () => {
    it("starts collapsed, under a heading, and reads nothing until opened", () => {
      render(<RampleSavePanel kitName="L1" />);

      const heading = screen.getByRole("heading", {
        level: 2,
        name: RAMPLE_SAVE_TEXT.title,
      });
      const toggle = within(heading).getByRole("button");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("rample-save-body")).not.toBeVisible();
      expect(
        screen.getByRole("region", { name: RAMPLE_SAVE_TEXT.title }),
      ).toBeInTheDocument();
      expect(globalThis.electronAPI.getKitRampleSave).not.toHaveBeenCalled();
    });

    it("opens with Enter and closes with Space, from the toggle", async () => {
      const user = userEvent.setup();
      render(<RampleSavePanel kitName="L1" />);
      const toggle = screen.getByRole("button", {
        name: RAMPLE_SAVE_TEXT.title,
      });

      await user.tab();
      expect(toggle).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveAttribute(
        "aria-controls",
        screen.getByTestId("rample-save-body").id,
      );
      expect(await screen.findByTestId("rample-save-found")).toBeVisible();
      expect(globalThis.electronAPI.getKitRampleSave).toHaveBeenCalledWith(
        "L1",
      );

      await user.keyboard(" ");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("rample-save-body")).not.toBeVisible();
    });

    it("reads the new kit's file when the kit changes while it's open", async () => {
      const { rerender } = await openPanel("L1");
      await screen.findByTestId("rample-save-found");

      serve({ copy: COPY, firmware, kitName: "L4", status: "noFile" });
      rerender(<RampleSavePanel kitName="L4" />);

      expect(
        await screen.findByTestId("rample-save-no-file"),
      ).toHaveTextContent(RAMPLE_SAVE_TEXT.noFile("L4"));
      expect(globalThis.electronAPI.getKitRampleSave).toHaveBeenLastCalledWith(
        "L4",
      );
    });
  });

  describe("a kit with a saved file", () => {
    it("shows each voice's raw values, a field to a row", async () => {
      await openPanel();
      const table = await screen.findByRole("table", {
        name: RAMPLE_SAVE_TEXT.voiceTableCaption,
      });

      const headers = within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent);
      expect(headers).toEqual([1, 2, 3, 4].map(RAMPLE_SAVE_TEXT.voice));

      const row = (key: string) =>
        within(screen.getByTestId(`rample-save-row-${key}`))
          .getAllByRole("cell")
          .map((td) => td.textContent);
      expect(row("level")).toEqual(["42", "127", "127", "127"]);
      expect(row("filter")).toEqual(["189", "127", "127", "127"]);
      expect(row("loop")).toEqual(["0", "127", "127", "127"]);
      expect(row("selected_layer")).toEqual(["1", "0", "3", "2"]);
      expect(row("layer_modes")).toEqual(["1", "1", "1", "1"]);
    });

    it("shows every per-voice field, labeled from the field table, with the device's key", async () => {
      await openPanel();
      await screen.findByTestId("rample-save-found");

      const rowHeaders = screen
        .getByTestId("rample-save-voices")
        .querySelectorAll("tbody th");
      expect([...rowHeaders].map((th) => th.textContent)).toEqual(
        RAMPLE_VOICE_FIELDS.map(
          (info) =>
            `${info.label}${info.meaning === "inferred" ? ` ${RAMPLE_SAVE_TEXT.inferredSuffix}` : ""}${info.deviceKey}`,
        ),
      );
      // Every label shown is one of the table's
      const labels = new Set(Object.values(RAMPLE_SAVE_FIELD_LABELS));
      for (const info of RAMPLE_VOICE_FIELDS)
        expect(labels).toContain(info.label);
    });

    it("marks every inferred meaning as inferred, with the check that would confirm it", async () => {
      await openPanel();
      await screen.findByTestId("rample-save-found");

      for (const info of RAMPLE_VOICE_FIELDS) {
        expect(info.meaning).toBe("inferred");
        expect(
          screen.getAllByTitle(RAMPLE_SAVE_TEXT.inferredTooltip(info.check))
            .length,
        ).toBeGreaterThan(0);
      }
      expect(
        screen.getByTitle(
          RAMPLE_SAVE_TEXT.inferredTooltip(RAMPLE_KIT_FIELDS.muteGroup.check),
        ),
      ).toHaveTextContent(RAMPLE_SAVE_TEXT.muteGroupsTitle);
      expect(
        screen.getByTitle(
          RAMPLE_SAVE_TEXT.inferredTooltip(RAMPLE_KIT_FIELDS.assignments.check),
        ),
      ).toHaveTextContent(RAMPLE_SAVE_TEXT.cvAssignmentsTitle);
    });

    it("says when the copy was taken, and the firmware, labeled inferred", async () => {
      await openPanel();
      const source = await screen.findByTestId("rample-save-source");
      expect(source).toHaveTextContent(
        RAMPLE_SAVE_TEXT.readFrom(formatTakenAt(TAKEN_AT)),
      );
      expect(screen.getByTestId("rample-save-firmware")).toHaveTextContent(
        RAMPLE_SAVE_TEXT.firmware("2.00"),
      );
      expect(screen.getByTestId("rample-save-firmware")).toHaveTextContent(
        /inferred/,
      );
    });

    it("says the firmware is unknown when nothing points to a release", async () => {
      serve(
        foundView({
          firmware: { ...firmware, candidates: [], label: "unknown" },
        }),
      );
      await openPanel();
      expect(
        await screen.findByTestId("rample-save-firmware"),
      ).toHaveTextContent(RAMPLE_SAVE_TEXT.firmwareUnknown);
    });

    it("shows the mute-group matrix as raw booleans, and the CV assignments as raw numbers", async () => {
      await openPanel();
      const mutes = await screen.findByTestId("rample-save-mutes");
      const cells = [...mutes.querySelectorAll("tbody td")];
      expect(cells).toHaveLength(16);
      expect(cells[1]).toHaveAttribute(
        "title",
        RAMPLE_SAVE_TEXT.muteCell(1, 2, true),
      );
      expect(cells[1]).toHaveTextContent("true");
      expect(cells[0]).toHaveTextContent("false");

      const cv = screen.getByTestId("rample-save-cv");
      const cvRows = within(cv).getAllByRole("row").slice(1);
      expect(cvRows.map((tr) => tr.textContent)).toEqual(
        [1, 2, 3, 4].map((input) => `${RAMPLE_SAVE_TEXT.cvInput(input)}90`),
      );
    });

    it("shows a dash, not a default, for a value the file hasn't, and lists missing keys", async () => {
      const view = foundView({ missingKeys: ["filter", "mute_group"] });
      delete view.values.filter;
      delete view.values.muteGroup;
      serve(view);
      await openPanel();

      const filter = await screen.findByTestId("rample-save-row-filter");
      expect(
        within(filter).getAllByTitle(RAMPLE_SAVE_TEXT.missingValueTooltip),
      ).toHaveLength(4);
      expect(screen.queryByTestId("rample-save-mutes")).not.toBeInTheDocument();
      expect(screen.getByTestId("rample-save-missing")).toHaveTextContent(
        RAMPLE_SAVE_TEXT.missingKeys("filter, mute_group"),
      );
    });

    it("lists unknown keys and odd shapes as other values, not hiding them", async () => {
      serve(
        foundView({
          otherValues: [
            { key: "zz_test", unexpectedShape: false, value: 1 },
            {
              key: "assignments[1].extra",
              unexpectedShape: false,
              value: { entries: [["a", [true, null, "x"]]] },
            },
            {
              key: "level",
              unexpectedShape: true,
              value: { opaque: { majorType: 7, size: 3 } },
            },
          ],
        }),
      );
      await openPanel();

      const other = await screen.findByTestId("rample-save-other");
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: RAMPLE_SAVE_TEXT.otherValuesTitle,
        }),
      ).toBeInTheDocument();
      const terms = within(other).getAllByRole("term");
      const definitions = within(other).getAllByRole("definition");
      expect(terms.map((dt) => dt.textContent)).toEqual([
        "zz_test",
        "assignments[1].extra",
        `level(${RAMPLE_SAVE_TEXT.otherValueUnexpected})`,
      ]);
      expect(definitions.map((dd) => dd.textContent)).toEqual([
        "1",
        '{a: [true, null, "x"]}',
        RAMPLE_SAVE_TEXT.opaqueValue(7, 3),
      ]);
    });

    it("has no other values section when every key is known", async () => {
      await openPanel();
      await screen.findByTestId("rample-save-found");
      expect(screen.queryByTestId("rample-save-other")).not.toBeInTheDocument();
    });
  });

  describe("without values to show", () => {
    it("says so when there's no copy of the card's saved settings yet", async () => {
      serve({ kitName: "L1", status: "noCopy" });
      await openPanel();
      expect(
        await screen.findByTestId("rample-save-no-copy"),
      ).toHaveTextContent(RAMPLE_SAVE_TEXT.noCopy);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("says the kit has no saved file, and shows no values", async () => {
      serve({ copy: COPY, firmware, kitName: "L1", status: "noFile" });
      await openPanel();
      const body = await screen.findByTestId("rample-save-no-file");
      expect(body).toHaveTextContent(RAMPLE_SAVE_TEXT.noFile("L1"));
      expect(body).toHaveTextContent(
        RAMPLE_SAVE_TEXT.readFrom(formatTakenAt(TAKEN_AT)),
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("says a file Romper can't decode is unreadable, with the reason", async () => {
      serve({
        copy: { folderName: "setup" },
        fileName: "L1.rpl",
        firmware,
        kitName: "L1",
        reason: "Truncated at byte 3",
        status: "unreadable",
      });
      await openPanel();
      const body = await screen.findByTestId("rample-save-unreadable");
      expect(body).toHaveTextContent(RAMPLE_SAVE_TEXT.unreadable("L1"));
      expect(body).toHaveTextContent(
        RAMPLE_SAVE_TEXT.unreadableDetail("L1.rpl", "Truncated at byte 3"),
      );
      expect(body).toHaveTextContent(RAMPLE_SAVE_TEXT.readFromUndated);
    });

    it("says when main couldn't read the copy", async () => {
      vi.mocked(globalThis.electronAPI.getKitRampleSave).mockResolvedValue({
        error: "EACCES",
        success: false,
      });
      await openPanel();
      expect(await screen.findByTestId("rample-save-error")).toHaveTextContent(
        RAMPLE_SAVE_TEXT.loadError("EACCES"),
      );
    });

    it("says it's reading while main reads", async () => {
      vi.mocked(globalThis.electronAPI.getKitRampleSave).mockReturnValue(
        new Promise(() => {}),
      );
      await openPanel();
      expect(screen.getByRole("status")).toHaveTextContent(
        RAMPLE_SAVE_TEXT.loading,
      );
      await waitFor(() =>
        expect(globalThis.electronAPI.getKitRampleSave).toHaveBeenCalled(),
      );
    });
  });
});

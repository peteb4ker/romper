import { describe, expect, it } from "vitest";

import { parseKitMetadataUpdates } from "../kitMetadataUpdates.js";

describe("[Q-02] parseKitMetadataUpdates (RE-22)", () => {
  it("accepts an alias and the editable flag", () => {
    expect(parseKitMetadataUpdates({ alias: "Drums", editable: true })).toEqual(
      { ok: true, updates: { alias: "Drums", editable: true } },
    );
  });

  it("accepts each field on its own, and a null alias to clear it", () => {
    expect(parseKitMetadataUpdates({ alias: "Drums" })).toEqual({
      ok: true,
      updates: { alias: "Drums" },
    });
    expect(parseKitMetadataUpdates({ editable: false })).toEqual({
      ok: true,
      updates: { editable: false },
    });
    expect(parseKitMetadataUpdates({ alias: null })).toEqual({
      ok: true,
      updates: { alias: null },
    });
  });

  it("ignores keys whose value is undefined", () => {
    expect(
      parseKitMetadataUpdates({ alias: "Drums", locked: undefined }),
    ).toEqual({ ok: true, updates: { alias: "Drums" } });
  });

  it.each([
    ["name", { name: "B9" }],
    ["bank_letter", { bank_letter: "Z" }],
    ["locked", { locked: false }],
    ["modified_since_sync", { modified_since_sync: false }],
    ["bpm", { bpm: 999 }],
    ["description", { description: "x" }],
  ])("refuses %s, which isn't a kit detail", (field, updates) => {
    expect(parseKitMetadataUpdates({ alias: "Drums", ...updates })).toEqual({
      error: `Kit details can't change ${field}`,
      ok: false,
    });
  });

  it("names every field it refuses", () => {
    expect(
      parseKitMetadataUpdates({ artist: "x", name: "B9", tags: [] }),
    ).toEqual({
      error: "Kit details can't change artist, name, tags",
      ok: false,
    });
  });

  it.each([
    ["a number alias", { alias: 7 }, "Kit alias must be text"],
    [
      "a string editable",
      { editable: "true" },
      "Kit editable must be true or false",
    ],
    [
      "a null editable",
      { editable: null },
      "Kit editable must be true or false",
    ],
  ])("refuses %s", (_label, updates, error) => {
    expect(parseKitMetadataUpdates(updates)).toEqual({ error, ok: false });
  });

  it.each([null, undefined, "alias", 42, ["alias"]])(
    "refuses %j, which isn't an object",
    (value) => {
      expect(parseKitMetadataUpdates(value)).toEqual({
        error: "Kit details must be an object",
        ok: false,
      });
    },
  );

  it("refuses an object with nothing to update", () => {
    expect(parseKitMetadataUpdates({})).toEqual({
      error: "No kit details to update",
      ok: false,
    });
  });
});

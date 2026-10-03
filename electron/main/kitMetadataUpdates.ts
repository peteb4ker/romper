import type { KitMetadataUpdates } from "@romper/shared/electronApi.js";

/**
 * The kit fields the renderer may change through `update-kit-metadata`
 * (RE-22). Everything else on a kit has its own channel (BPM, patterns,
 * slicer) or belongs to main (name, bank, lock, sync state), so an object
 * naming any other field is refused rather than written.
 */
const KIT_METADATA_FIELDS = ["alias", "editable"] as const;

export type KitMetadataUpdatesResult =
  | { error: string; ok: false }
  | { ok: true; updates: KitMetadataUpdates };

/**
 * Check the renderer's kit-details object and copy out only the allowed
 * fields. Keys whose value is `undefined` count as absent.
 */
export function parseKitMetadataUpdates(
  value: unknown,
): KitMetadataUpdatesResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "Kit details must be an object", ok: false };
  }

  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  const unknownFields = entries
    .map(([key]) => key)
    .filter((key) => !(KIT_METADATA_FIELDS as readonly string[]).includes(key));
  if (unknownFields.length > 0) {
    return {
      error: `Kit details can't change ${unknownFields.join(", ")}`,
      ok: false,
    };
  }

  const fields = Object.fromEntries(entries) as Record<string, unknown>;
  const updates: KitMetadataUpdates = {};

  if ("alias" in fields) {
    if (fields.alias !== null && typeof fields.alias !== "string") {
      return { error: "Kit alias must be text", ok: false };
    }
    updates.alias = fields.alias;
  }
  if ("editable" in fields) {
    if (typeof fields.editable !== "boolean") {
      return { error: "Kit editable must be true or false", ok: false };
    }
    updates.editable = fields.editable;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "No kit details to update", ok: false };
  }
  return { ok: true, updates };
}

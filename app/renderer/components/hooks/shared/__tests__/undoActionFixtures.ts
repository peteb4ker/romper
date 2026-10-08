import type {
  AddSampleAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
} from "@romper/shared/undoTypes";

/** Undo actions for the undo/redo hook tests, with realistic defaults */

const actionBase = (description: string) => ({
  description,
  id: "1767225600000-0a1b2c3d",
  timestamp: new Date("2026-01-01T00:00:00Z"),
});

export const addSampleAction = (
  data: Partial<AddSampleAction["data"]> = {},
): AddSampleAction => ({
  ...actionBase("Add sample"),
  data: {
    addedSample: { filename: "kick.wav", source_path: "/samples/kick.wav" },
    slot: 0,
    voice: 1,
    ...data,
  },
  type: "ADD_SAMPLE",
});

export const deleteSampleAction = (
  data: Partial<DeleteSampleAction["data"]> = {},
): DeleteSampleAction => ({
  ...actionBase("Delete sample"),
  data: {
    deletedSample: { filename: "kick.wav", source_path: "/samples/kick.wav" },
    slot: 0,
    voice: 1,
    ...data,
  },
  type: "DELETE_SAMPLE",
});

export const moveSampleAction = (
  data: Partial<MoveSampleAction["data"]> = {},
): MoveSampleAction => ({
  ...actionBase("Move sample"),
  data: {
    affectedSamples: [],
    fromSlot: 0,
    fromVoice: 1,
    movedSample: { filename: "kick.wav", source_path: "/samples/kick.wav" },
    toSlot: 1,
    toVoice: 2,
    voicesBefore: [],
    ...data,
  },
  type: "MOVE_SAMPLE",
});

export const moveSampleBetweenKitsAction = (
  data: Partial<MoveSampleBetweenKitsAction["data"]> = {},
): MoveSampleBetweenKitsAction => ({
  ...actionBase("Move sample between kits"),
  data: {
    affectedSamples: [],
    fromKit: "A0",
    fromSlot: 0,
    fromVoice: 1,
    mode: "insert",
    movedSample: { filename: "kick.wav", source_path: "/samples/kick.wav" },
    toKit: "A1",
    toSlot: 1,
    toVoice: 2,
    ...data,
  },
  type: "MOVE_SAMPLE_BETWEEN_KITS",
});

export const reindexSamplesAction = (
  data: Partial<ReindexSamplesAction["data"]> = {},
): ReindexSamplesAction => ({
  ...actionBase("Delete sample (with reindexing)"),
  data: {
    affectedSamples: [],
    deletedSample: { filename: "kick.wav", source_path: "/samples/kick.wav" },
    deletedSlot: 0,
    voice: 1,
    voicesBefore: [],
    ...data,
  },
  type: "REINDEX_SAMPLES",
});

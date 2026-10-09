// What the kit editor's "On the Rample" section shows for a kit (#800,
// stage 3 of #786): the kit's `_save/<kit>.rpl` from the latest copy of the
// card's `_save` folder in the store, decoded in main by the stage 1b reader
// (electron/main/rample/). Plain data, so it crosses IPC as it is: no `Map`s
// and no byte arrays.
//
// The values are the device's raw numbers. What most of them mean is
// inferred, not confirmed on hardware (docs/developer/
// rample-save-integration.md), so nothing here interprets them.

import type { RampleFirmwareGuess, RampleKitSave } from "./rampleSave.js";

/**
 * A value from the file, as plain data, for keys Romper shows as they are:
 * a map is a list of its entries, in the file's order, and an item outside
 * the CBOR subset the Rample writes is described, not decoded.
 */
export type RampleDisplayValue =
  | { entries: [key: string, value: RampleDisplayValue][] }
  | { opaque: { majorType: number; size: number } }
  | boolean
  | null
  | number
  | RampleDisplayValue[]
  | string;

/** The kit has a file in the latest copy, and it decoded. */
export interface RampleKitSaveFound extends RampleKitSaveViewCommon {
  copy: RampleSaveCopyInfo;
  fileName: string;
  /** Keys a kit file has on the firmware seen so far, but this one hasn't */
  missingKeys: string[];
  /**
   * Keys Romper doesn't know, and known keys whose value isn't the shape
   * the device writes, with their values: shown, never hidden.
   */
  otherValues: RampleOtherValue[];
  status: "found";
  /** The values Romper knows, raw; a key the file hasn't is undefined */
  values: RampleKitSave;
}

/** There's no copy of the card's `_save` folder in the store yet. */
export interface RampleKitSaveNoCopy extends RampleKitSaveViewCommon {
  status: "noCopy";
}

/** The latest copy has no file for this kit. */
export interface RampleKitSaveNoFile extends RampleKitSaveViewCommon {
  copy: RampleSaveCopyInfo;
  status: "noFile";
}

/** The kit's file is in the latest copy but couldn't be decoded. */
export interface RampleKitSaveUnreadable extends RampleKitSaveViewCommon {
  copy: RampleSaveCopyInfo;
  fileName: string;
  /** The reader's reason, for the technically minded */
  reason: string;
  status: "unreadable";
}

/** A kit file, or the lack of one, as the kit editor shows it. */
export type RampleKitSaveView =
  | RampleKitSaveFound
  | RampleKitSaveNoCopy
  | RampleKitSaveNoFile
  | RampleKitSaveUnreadable;

/** A value shown as it is: an unknown key, or a known one of an odd shape. */
export interface RampleOtherValue {
  /** The key's path in the file (`zz_test`, `assignments[1].extra`) */
  key: string;
  /** True for a key Romper knows whose value isn't the expected shape */
  unexpectedShape: boolean;
  value: RampleDisplayValue;
}

/** Which copy of the card's `_save` folder a view was read from. */
export interface RampleSaveCopyInfo {
  /** The copy's folder, under the store's `.romperdb/rample-save/` */
  folderName: string;
  /** When the copy was taken (ISO 8601), when it can be told */
  takenAt?: string;
}

interface RampleKitSaveViewCommon {
  /**
   * The firmware the copy's settings.rpl points to. A kit file has no
   * marker of its own, so this is the folder's guess, and always inferred.
   */
  firmware?: RampleFirmwareGuess;
  kitName: string;
}

import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared";
import React from "react";

import { saveFailed } from "../shared/useSettingSave";
import { useTimeouts } from "../shared/useTimeouts";
import {
  addScanResultToTotals,
  describeScanTotals,
  EMPTY_SCAN_TOTALS,
} from "./useKitScan";

export type ScanStatus =
  | {
      detail?: string;
      sampleCount: number;
      status: "success";
      /** What the stereo rules will do to the kit (#537) */
      stereoLines?: string[];
    }
  | { message: string; status: "error" }
  | { status: "idle" }
  | { status: "scanning" };

/** What inference says when it couldn't save some voices' names (#570) */
export function voiceNamesNotSaved(voices: number[]): string {
  if (voices.length === 1) {
    return `Couldn't save the name for voice ${voices[0]}. Try again.`;
  }
  const list = new Intl.ListFormat("en-US").format(voices.map(String));
  return `Couldn't save the names for voices ${list}. Try again.`;
}

/** What Scan Kit reports for a kit it scanned */
function scanSuccessStatus(
  kitName: string,
  data: Parameters<typeof addScanResultToTotals>[1],
): ScanStatus {
  const totals = addScanResultToTotals(EMPTY_SCAN_TOTALS, data, kitName);
  // The stereo lines say it per kit; the counts would repeat them
  const detail = describeScanTotals({
    ...totals,
    stereoAutoLinks: 0,
    stereoMixdowns: 0,
    stereoQuarantined: 0,
  });
  return {
    ...(detail ? { detail } : {}),
    sampleCount: data?.scannedSamples || 0,
    ...(totals.stereoLines.length > 0
      ? { stereoLines: totals.stereoLines }
      : {}),
    status: "success",
  };
}

/**
 * The voices inference names, with the name each gets: voices with samples
 * whose first sample suggests a type. A name the user set, or one inferred
 * earlier, is kept, as main's scan merge keeps it (RE-75).
 */
function voicesToName(
  samples: VoiceSamples,
  voiceNames: Partial<Record<number, null | string>> | undefined,
): { alias: string; voice: number }[] {
  const toName: { alias: string; voice: number }[] = [];
  for (const voice of [1, 2, 3, 4] as const) {
    const voiceSamples = samples[voice];
    if (!voiceSamples || voiceSamples.length === 0) continue;
    if (voiceNames?.[voice]?.trim()) continue;
    const alias = inferVoiceTypeFromFilename(voiceSamples[0]);
    if (alias) toName.push({ alias, voice });
  }
  return toName;
}

const FLASH_DURATION_MS = 1200;

const SCAN_SUCCESS_CLEAR_MS = 3000;

interface UseKitScanningParams {
  kitName: string;
  onRefreshKitMetadata?: () => Promise<void>;
  onRequestSamplesReload?: (kitName?: string) => Promise<void>;
  reloadKit: () => Promise<void>;
  samples: VoiceSamples;
  /**
   * The kit's current voice names, by voice number. Voices that already
   * have one keep it: inference only names unnamed voices (RE-75).
   */
  voiceNames?: Partial<Record<number, null | string>>;
}

/**
 * Kit scanning logic for the kit editor.
 *
 * Owns the two scan flows — filesystem rescan (handleScanKit) and in-memory
 * voice name inference for editable kits (handleInferVoiceNames) — plus the
 * inline scan status and voice-flash feedback state both flows drive.
 */
export function useKitScanning({
  kitName,
  onRefreshKitMetadata,
  onRequestSamplesReload,
  reloadKit,
  samples,
  voiceNames,
}: UseKitScanningParams) {
  // Scan status state (replaces toast-based feedback)
  const [scanStatus, setScanStatus] = React.useState<ScanStatus>({
    status: "idle",
  });
  const scanTimerRef = React.useRef<null | ReturnType<typeof setTimeout>>(null);

  // Flash feedback state for voice name updates
  const [flashVoices, setFlashVoices] = React.useState<Set<number>>(new Set());
  const flashTimerRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );

  // Cleared on unmount, so a scan that outlives the editor sets nothing
  const timeouts = useTimeouts();

  const scheduleStatusClear = React.useCallback(() => {
    timeouts.clear(scanTimerRef.current);
    scanTimerRef.current = timeouts.set(
      () => setScanStatus({ status: "idle" }),
      SCAN_SUCCESS_CLEAR_MS,
    );
  }, [timeouts]);

  const flashVoicePanels = React.useCallback(
    (voices: number[]) => {
      setFlashVoices(new Set(voices));
      timeouts.clear(flashTimerRef.current);
      flashTimerRef.current = timeouts.set(
        () => setFlashVoices(new Set()),
        FLASH_DURATION_MS,
      );
    },
    [timeouts],
  );

  // Handler for kit rescanning (database-first approach)
  const handleScanKit = React.useCallback(async () => {
    if (!kitName) return;

    setScanStatus({ status: "scanning" });

    try {
      if (!globalThis.electronAPI?.rescanKit) {
        throw new Error("Rescan API not available");
      }

      const result = await globalThis.electronAPI.rescanKit(kitName);

      if (result.success) {
        setScanStatus(scanSuccessStatus(kitName, result.data));

        // Auto-clear success status after delay
        scheduleStatusClear();

        // Flash voice panels to indicate updated names
        if (result.data?.updatedVoices && result.data.updatedVoices > 0) {
          flashVoicePanels([1, 2, 3, 4]);
        }

        // Reload the kit: its samples and the voice names the rescan
        // found, in one call (#452)
        if (onRequestSamplesReload) {
          await onRequestSamplesReload(kitName);
        } else {
          await reloadKit();
        }
      } else {
        setScanStatus({
          message: result.error || "Rescan failed",
          status: "error",
        });
      }
    } catch (error) {
      console.error("Kit scan error:", error);
      setScanStatus({
        message: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    }
  }, [
    kitName,
    onRequestSamplesReload,
    reloadKit,
    scheduleStatusClear,
    flashVoicePanels,
  ]);

  // Handler for in-memory voice name inference (editable kits without
  // filesystem directories): names only the voices that have no name
  const handleInferVoiceNames = React.useCallback(async () => {
    if (!kitName) return;

    setScanStatus({ status: "scanning" });

    try {
      const toName = voicesToName(samples, voiceNames);

      // Each call names a different voice, so they don't depend on each
      // other. A name main didn't save isn't counted or flashed, and is
      // reported (#570).
      const failed = await Promise.all(
        toName.map(({ alias, voice }) =>
          saveFailed(
            globalThis.electronAPI?.updateVoiceAlias?.(kitName, voice, alias),
            `the name for voice ${voice}`,
          ),
        ),
      );
      const updatedVoices = toName
        .filter((_, i) => !failed[i])
        .map(({ voice }) => voice);
      const failedVoices = toName
        .filter((_, i) => failed[i])
        .map(({ voice }) => voice);

      if (failedVoices.length > 0) {
        setScanStatus({
          message: voiceNamesNotSaved(failedVoices),
          status: "error",
        });
      } else {
        setScanStatus({
          sampleCount: updatedVoices.length,
          status: "success",
        });
        scheduleStatusClear();
      }

      // Flash updated voice panels before reload so animation renders immediately
      if (updatedVoices.length > 0) {
        flashVoicePanels(updatedVoices);
      }

      // Targeted refresh: only reload this kit's metadata, not all 187 kits.
      // A voice whose name wasn't saved keeps showing its saved name.
      if (onRefreshKitMetadata) {
        await onRefreshKitMetadata();
      } else {
        await reloadKit();
      }
    } catch (error) {
      console.error("Voice inference error:", error);
      setScanStatus({
        message: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    }
  }, [
    kitName,
    samples,
    voiceNames,
    reloadKit,
    onRefreshKitMetadata,
    scheduleStatusClear,
    flashVoicePanels,
  ]);

  return {
    flashVoices,
    handleInferVoiceNames,
    handleScanKit,
    scanStatus,
  };
}

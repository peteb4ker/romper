import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared";
import React from "react";

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

const FLASH_DURATION_MS = 1200;

const SCAN_SUCCESS_CLEAR_MS = 3000;

interface UseKitScanningParams {
  kitName: string;
  onRefreshKitMetadata?: () => Promise<void>;
  onRequestSamplesReload?: () => Promise<void>;
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

  // Clean up timers on unmount
  React.useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const scheduleStatusClear = React.useCallback(() => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(
      () => setScanStatus({ status: "idle" }),
      SCAN_SUCCESS_CLEAR_MS,
    );
  }, []);

  const flashVoicePanels = React.useCallback((voices: number[]) => {
    setFlashVoices(new Set(voices));
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(
      () => setFlashVoices(new Set()),
      FLASH_DURATION_MS,
    );
  }, []);

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

        // Trigger sample reload in parent component
        if (onRequestSamplesReload) {
          await onRequestSamplesReload();
        }

        // Reload kit to show updated voice names from rescan
        await reloadKit();
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
      const toName: { alias: string; voice: number }[] = [];

      for (const voice of [1, 2, 3, 4] as const) {
        const voiceSamples = samples[voice];
        if (!voiceSamples || voiceSamples.length === 0) continue;
        // A name the user set, or one inferred earlier, is kept, as main's
        // scan merge keeps it (RE-75)
        if (voiceNames?.[voice]?.trim()) continue;

        const inferredType = inferVoiceTypeFromFilename(voiceSamples[0]);
        if (!inferredType || !globalThis.electronAPI?.updateVoiceAlias)
          continue;
        toName.push({ alias: inferredType, voice });
      }

      // Each call names a different voice, so they don't depend on each other
      await Promise.all(
        toName.map(({ alias, voice }) =>
          globalThis.electronAPI.updateVoiceAlias(kitName, voice, alias),
        ),
      );
      const updatedVoices = toName.map(({ voice }) => voice);

      setScanStatus({ sampleCount: updatedVoices.length, status: "success" });

      scheduleStatusClear();

      // Flash updated voice panels before reload so animation renders immediately
      if (updatedVoices.length > 0) {
        flashVoicePanels(updatedVoices);
      }

      // Targeted refresh: only reload this kit's metadata, not all 187 kits
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

import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared";
import React from "react";

export type ScanStatus =
  | { message: string; status: "error" }
  | { sampleCount: number; status: "success" }
  | { status: "idle" }
  | { status: "scanning" };

const FLASH_DURATION_MS = 1200;

const SCAN_SUCCESS_CLEAR_MS = 3000;

interface UseKitScanningParams {
  kitName: string;
  onRefreshKitMetadata?: () => Promise<void>;
  onRequestSamplesReload?: () => Promise<void>;
  reloadKit: () => Promise<void>;
  samples: VoiceSamples;
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
        const sampleCount = result.data?.scannedSamples || 0;
        setScanStatus({ sampleCount, status: "success" });

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

  // Handler for in-memory voice name inference (editable kits without filesystem directories)
  const handleInferVoiceNames = React.useCallback(async () => {
    if (!kitName) return;

    setScanStatus({ status: "scanning" });

    try {
      const updatedVoices: number[] = [];

      for (const voice of [1, 2, 3, 4] as const) {
        const voiceSamples = samples[voice];
        if (!voiceSamples || voiceSamples.length === 0) continue;

        const inferredType = inferVoiceTypeFromFilename(voiceSamples[0]);
        if (inferredType && globalThis.electronAPI?.updateVoiceAlias) {
          await globalThis.electronAPI.updateVoiceAlias(
            kitName,
            voice,
            inferredType,
          );
          updatedVoices.push(voice);
        }
      }

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

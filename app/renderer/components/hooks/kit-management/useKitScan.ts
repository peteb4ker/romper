import type { KitScanResult, KitWithRelations } from "@romper/shared/db/schema";

import React, { useCallback } from "react";

const scanTypeDisplayMap: Record<string, string> = {
  voiceInference: "voice name inference",
  wavAnalysis: "WAV analysis",
};

export type BulkScanProgress =
  | { current: number; currentKit: string; status: "scanning"; total: number }
  | { message: string; status: "complete"; successCount: number }
  | { message: string; status: "error" }
  | { status: "idle" };

const BULK_SCAN_COMPLETE_CLEAR_MS = 5000;

/** Scan outcomes summed over one or more kits. */
export interface ScanTotals {
  added: number;
  editableSkipped: number;
  lockedKits: number;
  missing: number;
  voiceFullSkipped: number;
}

export function addScanResultToTotals(
  totals: ScanTotals,
  result: KitScanResult | undefined,
): ScanTotals {
  if (!result) return totals;
  const skipped = result.skippedFiles ?? [];
  return {
    added: totals.added + (result.addedSamples ?? 0),
    editableSkipped:
      totals.editableSkipped +
      skipped.filter((f) => f.reason === "kit_editable").length,
    lockedKits: totals.lockedKits + (result.locked ? 1 : 0),
    missing: totals.missing + (result.missingSamples?.length ?? 0),
    voiceFullSkipped:
      totals.voiceFullSkipped +
      skipped.filter((f) => f.reason === "voice_full").length,
  };
}

/**
 * One-line summary of what a scan changed, e.g.
 * "2 samples added, 1 missing file kept". Empty when nothing notable.
 */
export function describeScanTotals(totals: ScanTotals): string {
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (totals.added > 0) parts.push(`${plural(totals.added, "sample")} added`);
  if (totals.missing > 0)
    parts.push(`${plural(totals.missing, "sample")} missing on disk`);
  if (totals.voiceFullSkipped > 0)
    parts.push(
      `${plural(totals.voiceFullSkipped, "file")} skipped (voice has 12 samples)`,
    );
  if (totals.editableSkipped > 0)
    parts.push(
      `${plural(totals.editableSkipped, "new file")} not added to editable kits`,
    );
  if (totals.lockedKits > 0)
    parts.push(`${plural(totals.lockedKits, "locked kit")} left unchanged`);
  return parts.join(", ");
}

export const EMPTY_SCAN_TOTALS: ScanTotals = {
  added: 0,
  editableSkipped: 0,
  lockedKits: 0,
  missing: 0,
  voiceFullSkipped: 0,
};

export const SCAN_ALL_CONFIRM_MESSAGE =
  "Scan All re-reads every kit folder in the local store. New WAV files are " +
  "added to non-editable kits; existing samples, gain and slot order are " +
  "kept, and locked kits are skipped. Continue?";

export async function scanAllKits({
  kits,
  onProgress,
  onRefreshKits,
  operations,
}: {
  kits: KitWithRelations[];
  onProgress?: (progress: BulkScanProgress) => void;
  onRefreshKits?: () => void;
  operations?: string[];
}) {
  if (!kits || kits.length === 0) {
    onProgress?.({ message: "No kits to scan", status: "error" });
    return;
  }

  const { scanTypeDisplay } = getScanConfiguration(operations);

  onProgress?.({
    current: 0,
    currentKit: kits[0].name,
    status: "scanning",
    total: kits.length,
  });

  try {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    let totals = EMPTY_SCAN_TOTALS;

    for (let i = 0; i < kits.length; i++) {
      const kitName = kits[i].name;
      onProgress?.({
        current: i + 1,
        currentKit: kitName,
        status: "scanning",
        total: kits.length,
      });

      const result = await processSingleKitScan(kitName);

      if (result.success) {
        successCount++;
        totals = addScanResultToTotals(totals, result.data);
      } else {
        errorCount++;
        errors.push(result.error || "Unknown error");
      }
    }

    const completion = getCompletionMessage(
      successCount,
      errorCount,
      errors,
      scanTypeDisplay,
    );
    const detail = describeScanTotals(totals);

    onProgress?.({
      message: detail ? `${completion.message} ${detail}.` : completion.message,
      status: "complete",
      successCount,
    });

    if (onRefreshKits) {
      onRefreshKits();
    }
  } catch (error) {
    onProgress?.({
      message: `Scan error: ${error instanceof Error ? error.message : String(error)}`,
      status: "error",
    });
  }
}

export async function scanSingleKit({ kitName }: { kitName: string }) {
  // Delegate to the main-process scan, which merges the kit folder into the
  // database: adds unreferenced WAV files, keeps existing samples, reports
  // missing files, fills in WAV metadata and empty voice names (RE-04).
  if (!globalThis.electronAPI?.rescanKit) {
    return { error: "Rescan API not available", success: false as const };
  }
  return globalThis.electronAPI.rescanKit(kitName);
}

// --- useKitScan Hook ---
export function useKitScan({
  kits,
  onRefreshKits,
}: {
  kits: KitWithRelations[];
  onRefreshKits?: () => void;
}) {
  const [bulkScanProgress, setBulkScanProgress] =
    React.useState<BulkScanProgress>({ status: "idle" });
  const clearTimerRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleScanAllKits = useCallback(
    (operations?: string[]) => {
      // Clear any existing completion timer
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

      return scanAllKits({
        kits,
        onProgress: (progress) => {
          setBulkScanProgress(progress);

          // Auto-clear completion/error status after delay
          if (progress.status === "complete" || progress.status === "error") {
            clearTimerRef.current = setTimeout(
              () => setBulkScanProgress({ status: "idle" }),
              BULK_SCAN_COMPLETE_CLEAR_MS,
            );
          }
        },
        onRefreshKits,
        operations,
      });
    },
    [kits, onRefreshKits],
  );

  return { bulkScanProgress, handleScanAllKits };
}

// Helper function to generate completion message
function getCompletionMessage(
  successCount: number,
  errorCount: number,
  errors: string[],
  scanTypeDisplay: string,
) {
  if (errorCount === 0) {
    return {
      message: `All ${successCount} kits scanned successfully (${scanTypeDisplay}).`,
      type: "success" as const,
    };
  } else {
    const errorSummary = errors.slice(0, 3).join("; ");
    const truncated = errors.length > 3 ? "..." : "";
    return {
      message: `Scan completed: ${successCount} successful, ${errorCount} failed. ${errorSummary}${truncated}`,
      type: "warning" as const,
    };
  }
}

// Helper function to determine the display name for the scan
function getScanConfiguration(operations?: string[]) {
  const scanTypeDisplay =
    operations?.length === 1
      ? scanTypeDisplayMap[operations[0]] || operations[0]
      : "comprehensive";

  return { scanTypeDisplay };
}

// Helper function to process a single kit scan
async function processSingleKitScan(kitName: string) {
  try {
    const result = await scanSingleKit({ kitName });

    if (result.success) {
      return { data: result.data, success: true };
    }
    return {
      error: `${kitName}: ${result.error || "Unknown error"}`,
      success: false,
    };
  } catch (error) {
    return {
      error: `${kitName}: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useCallback } from "react";

// --- Utility Functions ---
import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../../utils/scanners/orchestrationFunctions";

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

export async function fileReader(filePath: string): Promise<ArrayBuffer> {
  if (!window.electronAPI?.readFile) {
    throw new Error("File reader not available");
  }
  const result = await window.electronAPI.readFile(filePath);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to read file");
  }
  return result.data;
}

export async function scanAllKits({
  fileReaderImpl = fileReader,
  kits,
  onProgress,
  onRefreshKits,
  operations,
}: {
  fileReaderImpl?: typeof fileReader;
  kits: KitWithRelations[];
  onProgress?: (progress: BulkScanProgress) => void;
  onRefreshKits?: () => void;
  operations?: string[];
}) {
  if (!kits || kits.length === 0) {
    onProgress?.({ message: "No kits to scan", status: "error" });
    return;
  }

  const { scanType, scanTypeDisplay } = getScanConfiguration(operations);

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

    for (let i = 0; i < kits.length; i++) {
      const kitName = kits[i].name;
      onProgress?.({
        current: i + 1,
        currentKit: kitName,
        status: "scanning",
        total: kits.length,
      });

      const result = await processSingleKitScan(
        kitName,
        scanType,
        scanTypeDisplay,
        fileReaderImpl,
      );

      if (result.success) {
        successCount++;
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

    onProgress?.({
      message: completion.message,
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

export async function scanSingleKit({
  fileReaderImpl,
  kitName: _kitName,
  scanType,
  scanTypeDisplay: _scanTypeDisplay,
}: {
  fileReaderImpl: typeof fileReader;
  kitName: string;
  scanType: string;
  scanTypeDisplay: string;
}) {
  if (scanType === "voiceInference") {
    const emptySamples = { 1: [], 2: [], 3: [], 4: [] };
    return executeVoiceInferenceScan(emptySamples);
  } else if (scanType === "wavAnalysis") {
    const wavFiles: string[] = [];
    return executeWAVAnalysisScan(wavFiles, fileReaderImpl);
  } else {
    // Full scan - voice inference and WAV analysis only
    const scanInput = {
      fileReader: fileReaderImpl,
      samples: { 1: [], 2: [], 3: [], 4: [] },
      wavFiles: [],
    };
    return executeFullKitScan(scanInput);
  }
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

// Helper function to determine scan type and display name
function getScanConfiguration(operations?: string[]) {
  const scanType = operations?.length === 1 ? operations[0] : "full";
  const scanTypeDisplay =
    operations?.length === 1
      ? scanTypeDisplayMap[operations[0]] || operations[0]
      : "comprehensive";

  return { scanType, scanTypeDisplay };
}

// Helper function to process a single kit scan
async function processSingleKitScan(
  kitName: string,
  scanType: string,
  scanTypeDisplay: string,
  fileReaderImpl: typeof fileReader,
) {
  try {
    const result = await scanSingleKit({
      fileReaderImpl,
      kitName,
      scanType,
      scanTypeDisplay,
    });

    if (result.success) {
      return { success: true };
    } else {
      return {
        error: `${kitName}: ${result.errors.map((e: { error: string; operation: string }) => e.error).join(", ")}`,
        success: false,
      };
    }
  } catch (error) {
    return {
      error: `${kitName}: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

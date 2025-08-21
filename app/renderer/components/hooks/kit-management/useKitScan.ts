import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback } from "react";
import { toast } from "sonner";

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
  onRefreshKits,
  operations,
  toastImpl = toast,
}: {
  fileReaderImpl?: typeof fileReader;
  kits: KitWithRelations[];
  onRefreshKits?: () => void;
  operations?: string[];
  toastImpl?: typeof toast;
}) {
  if (!kits || kits.length === 0) {
    toastImpl.error("Kits are required for scanning");
    return;
  }

  const { scanType, scanTypeDisplay } = getScanConfiguration(operations);

  const toastId = toastImpl.loading(
    `Starting ${scanTypeDisplay} scan of all kits...`,
    { duration: Infinity },
  );

  try {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < kits.length; i++) {
      const kitName = kits[i].name;
      toastImpl.loading(
        `Scanning kit ${i + 1}/${kits.length}: ${kitName} (${scanTypeDisplay})`,
        { duration: Infinity, id: toastId },
      );

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

    if (completion.type === "success") {
      toastImpl.success(completion.message, {
        duration: completion.duration,
        id: toastId,
      });
    } else {
      toastImpl.warning(completion.message, {
        duration: completion.duration,
        id: toastId,
      });
    }

    if (onRefreshKits) {
      onRefreshKits();
    }
  } catch (error) {
    toastImpl.error(
      `Scan error: ${error instanceof Error ? error.message : String(error)}`,
      { duration: 8000, id: toastId },
    );
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
  const handleScanAllKits = useCallback(
    (operations?: string[]) =>
      scanAllKits({
        kits,
        onRefreshKits,
        operations,
      }),
    [kits, onRefreshKits],
  );
  return { handleScanAllKits };
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
      duration: 5000,
      message: `All kits ${scanTypeDisplay} scan completed successfully! ${successCount} kits processed.`,
      type: "success" as const,
    };
  } else {
    const errorSummary = errors.slice(0, 3).join("; ");
    const truncated = errors.length > 3 ? "..." : "";
    return {
      duration: 8000,
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

import { useCallback } from "react";
import { toast } from "sonner";

import type { KitWithRelations } from "../../../../shared/db/schema";
// --- Utility Functions ---
import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../utils/scanners/orchestrationFunctions";

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

export async function scanSingleKit({
  kitName,
  scanType,
  scanTypeDisplay,
  fileReaderImpl,
}: {
  kitName: string;
  scanType: string;
  scanTypeDisplay: string;
  fileReaderImpl: typeof fileReader;
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
      samples: { 1: [], 2: [], 3: [], 4: [] },
      wavFiles: [],
      fileReader: fileReaderImpl,
    };
    return executeFullKitScan(scanInput);
  }
}

export async function scanAllKits({
  kits,
  operations,
  onRefreshKits,
  toastImpl = toast,
  fileReaderImpl = fileReader,
}: {
  kits: KitWithRelations[];
  operations?: string[];
  onRefreshKits?: () => void;
  toastImpl?: typeof toast;
  fileReaderImpl?: typeof fileReader;
}) {
  if (!kits || kits.length === 0) {
    toastImpl.error("Kits are required for scanning");
    return;
  }

  const scanType = operations?.length === 1 ? operations[0] : "full";
  const scanTypeDisplay =
    operations?.length === 1
      ? scanTypeDisplayMap[operations[0]] || operations[0]
      : "comprehensive";

  const toastId = toastImpl.loading(
    `Starting ${scanTypeDisplay} scan of all kits...`,
    {
      duration: Infinity,
    },
  );

  try {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < kits.length; i++) {
      const kitName = kits[i].name;
      toastImpl.loading(
        `Scanning kit ${i + 1}/${kits.length}: ${kitName} (${scanTypeDisplay})`,
        {
          id: toastId,
          duration: Infinity,
        },
      );
      try {
        const result = await scanSingleKit({
          kitName,
          scanType,
          scanTypeDisplay,
          fileReaderImpl,
        });
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(
            `${kitName}: ${result.errors.map((e: any) => e.error).join(", ")}`,
          );
        }
      } catch (error) {
        errorCount++;
        errors.push(
          `${kitName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (errorCount === 0) {
      toastImpl.success(
        `All kits ${scanTypeDisplay} scan completed successfully! ${successCount} kits processed.`,
        { id: toastId, duration: 5000 },
      );
    } else {
      const message = `Scan completed: ${successCount} successful, ${errorCount} failed. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`;
      toastImpl.warning(message, { id: toastId, duration: 8000 });
    }

    if (onRefreshKits) {
      onRefreshKits();
    }
  } catch (error) {
    toastImpl.error(
      `Scan error: ${error instanceof Error ? error.message : String(error)}`,
      { id: toastId, duration: 8000 },
    );
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
        operations,
        onRefreshKits,
      }),
    [kits, onRefreshKits],
  );
  return { handleScanAllKits };
}

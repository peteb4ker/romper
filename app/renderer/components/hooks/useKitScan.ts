import { useCallback } from "react";
import { toast } from "sonner";

import { getBankNames } from "../utils/bankOperations";
// --- Utility Functions ---
import {
  executeFullKitScan,
  executeRTFArtistScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../utils/scanners/orchestrationFunctions";

const scanTypeDisplayMap: Record<string, string> = {
  voiceInference: "voice name inference",
  wavAnalysis: "WAV analysis",
  rtfArtist: "artist metadata",
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
  localStorePath,
  scanType,
  scanTypeDisplay,
  fileReaderImpl,
}: {
  kitName: string;
  localStorePath: string;
  scanType: string;
  scanTypeDisplay: string;
  fileReaderImpl: typeof fileReader;
}) {
  const bankNames = await getBankNames(localStorePath);
  const bankName = kitName.charAt(0).toUpperCase();
  const rtfFiles: string[] = [];
  if (bankNames[bankName]) {
    rtfFiles.push(`${localStorePath}/${bankName} - ${bankNames[bankName]}.rtf`);
  }

  if (scanType === "voiceInference") {
    const emptySamples = { 1: [], 2: [], 3: [], 4: [] };
    return executeVoiceInferenceScan(emptySamples);
  } else if (scanType === "wavAnalysis") {
    const wavFiles: string[] = [];
    return executeWAVAnalysisScan(wavFiles, fileReaderImpl);
  } else if (scanType === "rtfArtist") {
    return executeRTFArtistScan(rtfFiles);
  } else {
    const scanInput = {
      samples: { 1: [], 2: [], 3: [], 4: [] },
      wavFiles: [],
      rtfFiles,
      fileReader: fileReaderImpl,
    };
    return executeFullKitScan(scanInput);
  }
}

export async function scanAllKits({
  kits,
  localStorePath,
  operations,
  onRefreshKits,
  toastImpl = toast,
  fileReaderImpl = fileReader,
}: {
  kits: string[];
  localStorePath: string;
  operations?: string[];
  onRefreshKits?: () => void;
  toastImpl?: typeof toast;
  fileReaderImpl?: typeof fileReader;
}) {
  if (!localStorePath || !kits || kits.length === 0) {
    toastImpl.error("Local store path and kits are required for scanning");
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
      const kitName = kits[i];
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
          localStorePath,
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
  localStorePath,
  onRefreshKits,
}: {
  kits: string[];
  localStorePath: string;
  onRefreshKits?: () => void;
}) {
  const handleScanAllKits = useCallback(
    (operations?: string[]) =>
      scanAllKits({
        kits,
        localStorePath,
        operations,
        onRefreshKits,
      }),
    [kits, localStorePath, onRefreshKits],
  );
  return { handleScanAllKits };
}

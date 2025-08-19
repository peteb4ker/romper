import { groupSamplesByVoice } from "@romper/shared/kitUtilsShared";
import { useCallback, useMemo } from "react";

import type { ElectronAPI } from "../../../electron.d";
import type { FullKitScanInput } from "../../utils/scanners/types";

import { executeFullKitScan } from "../../utils/scanners/orchestrationFunctions";

export interface UseLocalStoreWizardScanningOptions {
  api: ElectronAPI;
  reportStepProgress: (options: {
    items: string[];
    onStep: (item: string, idx: number) => Promise<void>;
    phase: string;
  }) => Promise<void>;
}

/**
 * Hook for managing Local Store Wizard scanning operations
 * Extracted from useLocalStoreWizard to reduce complexity
 */
export function useLocalStoreWizardScanning({
  api,
  reportStepProgress,
}: UseLocalStoreWizardScanningOptions) {
  const runScanning = useCallback(
    async (targetPath: string, dbDir: string, kitNames: string[]) => {
      if (kitNames.length === 0) {
        console.log("[Hook] No kits to scan, skipping scanning phase");
        return;
      }

      console.log(
        "[Hook] Starting scanning operations for",
        kitNames.length,
        "kits"
      );

      // Create a file reader that works with Electron APIs
      const createFileReader = () => {
        return async (filePath: string): Promise<ArrayBuffer> => {
          if (!api.readFile) {
            throw new Error("File reading not available");
          }
          const result = await api.readFile(filePath);
          if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to read file");
          }
          return result.data;
        };
      };

      // Helper function to process individual kit scan
      const processSingleKit = async (kitName: string) => {
        try {
          const kitPath = `${targetPath}/${kitName}`;
          if (!api.listFilesInRoot) {
            throw new Error("listFilesInRoot is not available");
          }

          const files = await api.listFilesInRoot(kitPath);
          const wavFiles = files
            .filter((f: string) => /\.wav$/i.test(f))
            .map((f: string) => `${kitPath}/${f}`);

          // Group samples by voice for voice inference
          const wavFileNames = files.filter((f: string) => /\.wav$/i.test(f));
          const samples = groupSamplesByVoice(wavFileNames);

          // Prepare scan input
          const scanInput: FullKitScanInput = {
            fileReader: createFileReader(),
            samples,
            wavFiles,
          };

          // Execute the full scan chain with error handling
          const scanResult = await executeFullKitScan(
            scanInput,
            undefined, // No detailed progress callback for now
            "continue" // Continue on errors
          );

          // Apply voice inference results to individual voices
          await applyVoiceInferenceResults(kitName, scanResult);

          // Log scan results for debugging
          if (scanResult.errors.length > 0) {
            console.warn(
              `[Hook] Scan warnings for kit ${kitName}:`,
              scanResult.errors
            );
          }
        } catch (error) {
          console.error(`[Hook] Scanning failed for kit ${kitName}:`, error);
          // Continue with other kits even if one fails
        }
      };

      // Helper function to apply voice inference results
      const applyVoiceInferenceResults = async (
        kitName: string,
        scanResult: any
      ) => {
        if (
          scanResult.success &&
          scanResult.results.voiceInference?.voiceNames
        ) {
          const voiceNames = scanResult.results.voiceInference.voiceNames;

          // Update each voice with its inferred alias
          for (const [voiceNumber, voiceName] of Object.entries(voiceNames)) {
            await updateSingleVoiceAlias(kitName, voiceNumber, voiceName);
          }
        }
      };

      // Helper function to update single voice alias
      const updateSingleVoiceAlias = async (
        kitName: string,
        voiceNumber: string,
        voiceName: any
      ) => {
        if (
          voiceName &&
          typeof voiceName === "string" &&
          api.updateVoiceAlias
        ) {
          try {
            const result = await api.updateVoiceAlias(
              kitName,
              parseInt(voiceNumber, 10),
              voiceName
            );
            if (result.success) {
              console.log(
                `[Hook] Set voice ${voiceNumber} alias to "${voiceName}" for kit ${kitName}`
              );
            } else {
              console.warn(
                `[Hook] Failed to set voice alias for kit ${kitName}, voice ${voiceNumber}:`,
                result.error
              );
            }
          } catch (error) {
            console.warn(
              `[Hook] Error setting voice alias for kit ${kitName}, voice ${voiceNumber}:`,
              error
            );
          }
        }
      };

      await reportStepProgress({
        items: kitNames,
        onStep: processSingleKit,
        phase: "Scanning kits for metadata...",
      });

      console.log("[Hook] Scanning operations completed");
    },
    [api, reportStepProgress]
  );

  return useMemo(
    () => ({
      runScanning,
    }),
    [runScanning]
  );
}

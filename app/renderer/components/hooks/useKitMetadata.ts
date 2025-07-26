import { useCallback, useEffect, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";
import { getBankNames } from "../utils/bankOperations";
import {
  executeFullKitScan,
  executeVoiceInferenceScan,
} from "../utils/scanners/orchestrationFunctions";

// Database-backed hook for kit metadata (replacing JSON file dependency)
export interface KitMetadata {
  id: number;
  name: string;
  alias?: string;
  artist?: string;
  editable: boolean;
  locked: boolean;
  step_pattern?: number[][];
  voices: { [voiceNumber: number]: string };
}

export interface KitDetailsProps {
  kitName: string;
  localStorePath: string;
}

export function useKitMetadata(props: KitDetailsProps) {
  const { kitName, localStorePath } = props;
  const { localStorePath: contextLocalStorePath } = useSettings();
  const [kitMetadata, setKitMetadata] = useState<KitMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadataChanged, setMetadataChanged] = useState(false);
  const [stepPattern, setStepPatternState] = useState<number[][] | null>(null);

  // Get database directory from local store path
  const dbDir = localStorePath || contextLocalStorePath;

  const loadKitMetadata = useCallback(async () => {
    if (!window.electronAPI?.getKitMetadata || !dbDir || !kitName) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getKitMetadata(dbDir, kitName);
      if (result.success && result.data) {
        setKitMetadata(result.data);
      } else {
        // Kit doesn't exist in database, create default metadata
        const defaultMetadata: KitMetadata = {
          id: 0, // Will be set when inserted
          name: kitName,
          editable: false,
          locked: false,
          voices: { 1: "", 2: "", 3: "", 4: "" },
        };
        setKitMetadata(defaultMetadata);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kit metadata");
    } finally {
      setLoading(false);
    }
  }, [dbDir, kitName]);

  useEffect(() => {
    if (!dbDir || !kitName) return;
    loadKitMetadata();
  }, [dbDir, kitName, loadKitMetadata]);

  // Load stepPattern when kitMetadata changes
  useEffect(() => {
    if (kitMetadata && kitMetadata.step_pattern) {
      setStepPatternState(kitMetadata.step_pattern);
    } else {
      // Default: 4x16 with velocity 0 (off)
      setStepPatternState(Array.from({ length: 4 }, () => Array(16).fill(0)));
    }
  }, [kitMetadata]);

  const updateMetadata = async (updates: {
    alias?: string;
    artist?: string;
    tags?: string[];
    description?: string;
  }) => {
    if (!window.electronAPI?.updateKit || !dbDir || !kitName) return;

    try {
      const result = await window.electronAPI.updateKit(
        dbDir,
        kitName,
        updates,
      );
      if (result.success) {
        await loadKitMetadata(); // Reload to get updated data
        setMetadataChanged(true);
      } else {
        setError(result.error || "Failed to update metadata");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update metadata");
    }
  };

  const updateVoiceAlias = async (voiceNumber: number, voiceAlias: string) => {
    if (!window.electronAPI?.updateVoiceAlias || !dbDir || !kitName) return;

    try {
      const result = await window.electronAPI.updateVoiceAlias(
        dbDir,
        kitName,
        voiceNumber,
        voiceAlias,
      );
      if (result.success) {
        await loadKitMetadata(); // Reload to get updated data
        setMetadataChanged(true);
      } else {
        setError(result.error || "Failed to update voice alias");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update voice alias");
    }
  };

  const updateStepPattern = async (pattern: number[][]) => {
    if (!window.electronAPI?.updateStepPattern || !dbDir || !kitName) return;

    console.log(
      `[useKitMetadata] Saving step pattern for ${kitName}:`,
      pattern,
    );

    // Update UI state immediately for responsive feedback
    setStepPatternState(pattern);

    try {
      const result = await window.electronAPI.updateStepPattern(
        dbDir,
        kitName,
        pattern,
      );
      if (!result.success) {
        console.error(
          `[useKitMetadata] Failed to save step pattern:`,
          result.error,
        );
        setError(result.error || "Failed to update step pattern");
        // Revert UI state on failure
        await loadKitMetadata();
      } else {
        console.log(
          `[useKitMetadata] Successfully saved step pattern for ${kitName}`,
        );
      }
    } catch (e) {
      console.error(`[useKitMetadata] Exception saving step pattern:`, e);
      setError(
        e instanceof Error ? e.message : "Failed to update step pattern",
      );
      // Revert UI state on failure
      await loadKitMetadata();
    }
  };

  // Compatibility methods for existing components
  const handleSaveKitLabel = async (newLabel: string) => {
    await updateMetadata({ alias: newLabel });
  };

  const handleSaveKitTags = async (tags: string[]) => {
    await updateMetadata({ tags });
  };

  const handleSaveKitMetadata = async (
    label: string,
    description: string,
    tags: string[],
  ) => {
    await updateMetadata({ alias: label, description, tags });
  };

  const handleSaveVoiceName = async (voice: number, newName: string) => {
    await updateVoiceAlias(voice, newName);
  };

  const handleRescanVoiceName = async (
    voice: number,
    voices: { [key: number]: string[] },
  ) => {
    // Create samples object with only the requested voice
    const voiceSamples = { [voice]: voices[voice] || [] };

    const result = await executeVoiceInferenceScan(voiceSamples);

    if (result.success && result.results.voiceInference?.voiceNames) {
      const voiceNames = result.results.voiceInference.voiceNames;
      const inferredName = voiceNames[voice] || "";
      await updateVoiceAlias(voice, inferredName);
    }
  };

  const handleRescanAllVoiceNames = async (
    voices: { [key: number]: string[] } | undefined,
  ) => {
    const safeVoices = voices || { 1: [], 2: [], 3: [], 4: [] };

    const result = await executeVoiceInferenceScan(safeVoices);

    if (result.success && result.results.voiceInference?.voiceNames) {
      const voiceNames = result.results.voiceInference.voiceNames;

      // Update all voice aliases with inferred names
      for (let voice = 1; voice <= 4; voice++) {
        const inferredName = voiceNames[voice] || "";
        await updateVoiceAlias(voice, inferredName);
      }
    }
  };

  const handleFullKitScan = async (
    voices: { [key: number]: string[] } | undefined,
    progressCallback?: (phase: string, progress: number) => void,
  ) => {
    if (!dbDir || !kitName) {
      return {
        success: false,
        errors: ["Database directory and kit name are required"],
        results: {},
      };
    }

    try {
      const safeVoices = voices || { 1: [], 2: [], 3: [], 4: [] };
      const actualLocalStorePath = localStorePath || contextLocalStorePath;
      if (!actualLocalStorePath) {
        throw new Error("Local store path is required for scanning");
      }

      const kitPath = `${actualLocalStorePath}/${kitName}`;

      // Get all WAV files from samples
      const wavFiles: string[] = [];
      Object.values(safeVoices).forEach((voiceSamples: string[]) => {
        voiceSamples.forEach((sample: string) => {
          if (sample.endsWith(".wav")) {
            wavFiles.push(`${kitPath}/${sample}`);
          }
        });
      });

      // Artist metadata is now handled by bank scanning, not kit scanning

      // Adapt electron API fileReader to scanner interface
      const fileReader = async (filePath: string): Promise<ArrayBuffer> => {
        if (!window.electronAPI?.readFile) {
          throw new Error("File reader not available");
        }
        const result = await window.electronAPI.readFile(filePath);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to read file");
        }
        return result.data;
      };

      const scanInput = {
        samples: safeVoices,
        wavFiles,
        fileReader,
      };

      const orchestratorProgressCallback = (
        current: number,
        total: number,
        operation: string,
      ) => {
        const progress = Math.round((current / total) * 100);
        progressCallback?.(operation, progress);
      };

      const result = await executeFullKitScan(
        scanInput,
        orchestratorProgressCallback,
      );

      if (result.success) {
        // Update metadata based on scan results
        if (result.results.voiceInference?.voiceNames) {
          const voiceNames = result.results.voiceInference.voiceNames;
          for (let voice = 1; voice <= 4; voice++) {
            const inferredName = voiceNames[voice] || "";
            if (inferredName) {
              await updateVoiceAlias(voice, inferredName);
            }
          }
        }

        // Artist metadata is now handled by bank scanning system

        // WAV analysis results are stored in the database automatically
        // through the scanning operations
      }

      return {
        success: result.success,
        errors: result.errors.map((e) => e.error),
        results: result.results,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        results: {},
      };
    }
  };

  return {
    kitMetadata,
    setKitMetadata,
    loading,
    error,
    metadataChanged,
    setMetadataChanged,
    stepPattern, // Return raw velocity values for direct access
    setStepPattern: (velocityPattern: number[][]) => {
      // Accept velocity pattern directly - call async function but don't await
      // This allows the UI to update immediately while the DB save happens in background
      updateStepPattern(velocityPattern);
    },
    // Compatibility methods for existing components
    kitLabel: kitMetadata
      ? {
          label: kitMetadata.alias || kitMetadata.name,
          description: undefined, // Not stored in current schema
          tags: undefined, // Not stored in current schema
          voiceNames: kitMetadata.voices,
          stepPattern: stepPattern, // Use velocity values directly
        }
      : null,
    setKitLabel: setKitMetadata,
    labelsLoading: loading,
    labelsError: error,
    editingKitLabel: false, // Not needed for database version
    setEditingKitLabel: () => {}, // Not needed for database version
    kitLabelInput: kitMetadata?.alias || kitMetadata?.name || "",
    setKitLabelInput: () => {}, // Not needed for database version
    handleSaveKitLabel,
    handleSaveKitTags,
    handleSaveKitMetadata,
    handleSaveVoiceName,
    handleRescanVoiceName,
    handleRescanAllVoiceNames,
    handleFullKitScan,
    reloadKitLabel: loadKitMetadata,
  };
}

import { useCallback, useEffect, useState } from "react";

import { useSettings } from "../../utils/SettingsContext";

// Database-backed hook for kit metadata (replacing JSON file dependency)
export interface KitMetadata {
  id: number;
  name: string;
  alias?: string;
  artist?: string;
  plan_enabled: boolean;
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
          plan_enabled: false,
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
    if (!window.electronAPI?.updateKitMetadata || !dbDir || !kitName) return;

    try {
      const result = await window.electronAPI.updateKitMetadata(
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

    setStepPatternState(pattern);

    try {
      const result = await window.electronAPI.updateStepPattern(
        dbDir,
        kitName,
        pattern,
      );
      if (result.success) {
        await loadKitMetadata(); // Reload to get updated data
      } else {
        setError(result.error || "Failed to update step pattern");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to update step pattern",
      );
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
    // Use the new scanning operations for individual voice rescanning
    const { executeVoiceInferenceScan } = await import(
      "../utils/scanners/orchestrationFunctions"
    );

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
    // Use the new scanning operations for comprehensive voice name scanning
    const { executeVoiceInferenceScan } = await import(
      "../utils/scanners/orchestrationFunctions"
    );

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
      // Import the comprehensive scanning operations
      const { executeFullKitScan } = await import(
        "../utils/scanners/orchestrationFunctions"
      );

      const safeVoices = voices || { 1: [], 2: [], 3: [], 4: [] };
      const kitPath = `${dbDir}/${kitName}`;

      // Get all WAV files from samples
      const wavFiles: string[] = [];
      Object.values(safeVoices).forEach((voiceSamples: string[]) => {
        voiceSamples.forEach((sample: string) => {
          if (sample.endsWith(".wav")) {
            wavFiles.push(`${kitPath}/${sample}`);
          }
        });
      });

      // Get RTF files (artist metadata files)
      const rtfFiles: string[] = [];
      const bankName = kitName.charAt(0);
      if (bankName >= "A" && bankName <= "Z") {
        rtfFiles.push(`${dbDir}/${bankName}.rtf`);
      }

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
        rtfFiles,
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

        // Update artist metadata if available
        if (result.results.rtfArtist?.artists) {
          const artists = result.results.rtfArtist.artists;
          const bankName = kitName.charAt(0);
          if (artists[bankName]) {
            await updateMetadata({ artist: artists[bankName] });
          }
        }

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
    setStepPattern: async (velocityPattern: number[][]) => {
      // Accept velocity pattern directly
      await updateStepPattern(velocityPattern);
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

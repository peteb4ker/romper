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
    // Import the scanning utility
    const { inferVoiceTypeFromFilename } = await import(
      "../../../../shared/kitUtilsShared"
    );

    const samples = voices[voice] || [];
    let inferredName: string | null = null;
    for (const sample of samples) {
      const type = inferVoiceTypeFromFilename(sample);
      if (type) {
        inferredName = type;
        break;
      }
    }

    await updateVoiceAlias(voice, inferredName || "");
  };

  const handleRescanAllVoiceNames = async (
    voices: { [key: number]: string[] } | undefined,
  ) => {
    // Import the scanning utility
    const { inferVoiceTypeFromFilename } = await import(
      "../../../../shared/kitUtilsShared"
    );

    const safeVoices = voices || { 1: [], 2: [], 3: [], 4: [] };

    for (let voice = 1; voice <= 4; voice++) {
      const samplesForVoice = safeVoices[voice] || [];
      let inferredName: string | null = null;
      for (const sample of samplesForVoice) {
        const type = inferVoiceTypeFromFilename(sample);
        if (type) {
          inferredName = type;
          break;
        }
      }
      await updateVoiceAlias(voice, inferredName || "");
    }
  };

  return {
    kitMetadata,
    setKitMetadata,
    loading,
    error,
    metadataChanged,
    setMetadataChanged,
    stepPattern: stepPattern
      ? stepPattern.map((voice) => voice.map((v) => v > 0))
      : null, // Convert velocity to boolean for UI
    setStepPattern: async (booleanPattern: boolean[][]) => {
      // Convert boolean pattern to velocity pattern (true -> 100, false -> 0)
      const velocityPattern = booleanPattern.map((voice) =>
        voice.map((step) => (step ? 100 : 0)),
      );
      await updateStepPattern(velocityPattern);
    },
    // Compatibility methods for existing components
    kitLabel: kitMetadata
      ? {
          label: kitMetadata.alias || kitMetadata.name,
          description: undefined, // Not stored in current schema
          tags: undefined, // Not stored in current schema
          voiceNames: kitMetadata.voices,
          stepPattern: stepPattern
            ? stepPattern.map((voice) => voice.map((v) => v > 0))
            : undefined, // Convert velocity to boolean
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
    reloadKitLabel: loadKitMetadata,
  };
}

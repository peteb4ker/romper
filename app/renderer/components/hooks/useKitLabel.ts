import { useEffect, useRef, useState } from "react";

import { KitDetailsProps, RampleKitLabel, RampleLabels } from "../kitTypes";
import { groupSamplesByVoice, inferVoiceTypeFromFilename } from '../../../../shared/kitUtilsShared';

export function useKitLabel(props: KitDetailsProps) {
  const { kitName, sdCardPath } = props;
  const [kitLabel, setKitLabel] = useState<RampleKitLabel | null>(null);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [editingKitLabel, setEditingKitLabel] = useState(false);
  const [kitLabelInput, setKitLabelInput] = useState("");
  const [metadataChanged, setMetadataChanged] = useState(false);
  const [stepPattern, setStepPatternState] = useState<boolean[][] | null>(null);

  useEffect(() => {
    if (!sdCardPath || !kitName) return;
    setLabelsLoading(true);
    setLabelsError(null);
    // @ts-ignore
    window.electronAPI
      .readRampleLabels(sdCardPath)
      .then(async (labels: RampleLabels | null) => {
        let kit: RampleKitLabel | null = null;
        if (labels && labels.kits && labels.kits[kitName]) {
          kit = labels.kits[kitName];
        } else if (kitName) {
          kit = { label: kitName };
        }
        // --- Normalize kitLabel: always ensure voiceNames exists and has 1-4 ---
        if (kit) {
          if (!kit.voiceNames) kit.voiceNames = { 1: "", 2: "", 3: "", 4: "" };
        }
        setKitLabel(kit);
      })
      .catch((e) => setLabelsError("Failed to load kit metadata."))
      .finally(() => setLabelsLoading(false));
  }, [sdCardPath, kitName]);

  useEffect(() => {
    setKitLabelInput(kitLabel?.label || "");
  }, [kitLabel?.label]);

  // Load stepPattern from kitLabel when it changes
  useEffect(() => {
    if (kitLabel && kitLabel.stepPattern) {
      setStepPatternState(kitLabel.stepPattern);
    } else {
      // Default: 4x16 false
      setStepPatternState(
        Array.from({ length: 4 }, () => Array(16).fill(false)),
      );
    }
  }, [kitLabel]);

  // --- Utility: updateKitLabel ---
  async function updateKitLabel(update: (kit: RampleKitLabel) => void) {
    // @ts-ignore
    const labels: RampleLabels = (await window.electronAPI.readRampleLabels(
      sdCardPath,
    )) || { kits: {} };
    const kit = labels.kits[kitName] || { label: kitName };
    update(kit);
    labels.kits[kitName] = kit;
    // @ts-ignore
    await window.electronAPI.writeRampleLabels(sdCardPath, labels);
    return kit;
  }

  const handleSaveKitLabel = async (newLabel: string) => {
    if (!sdCardPath || !kitName) return;
    const kit = await updateKitLabel((kit) => {
      kit.label = newLabel;
    });
    setKitLabel({ ...kit });
    setMetadataChanged(true);
  };
  const handleSaveKitTags = async (tags: string[]) => {
    if (!sdCardPath || !kitName) return;
    const kit = await updateKitLabel((kit) => {
      kit.tags = tags;
    });
    setKitLabel({ ...kit });
    setMetadataChanged(true);
  };
  const handleSaveKitMetadata = async (
    label: string,
    description: string,
    tags: string[],
  ) => {
    const kit = await updateKitLabel((kit) => {
      kit.label = label;
      if (description.trim() !== "") kit.description = description.trim();
      if (tags.length > 0) kit.tags = tags;
    });
    setKitLabel(kit);
  };
  const handleSaveVoiceName = async (voice: number, newName: string) => {
    if (!sdCardPath || !kitName) return;
    const kit = await updateKitLabel((kit) => {
      kit.voiceNames = { ...(kit.voiceNames || {}), [voice]: newName };
    });
    setKitLabel({ ...kit });
  };
  // Accept voices as an argument for rescanning
  const handleRescanVoiceName = async (
    voice: number,
    voices: { [key: number]: string[] },
  ) => {
    if (!sdCardPath || !kitName) return;
    const samples = voices[voice] || [];
    let inferredName: string | null = null;
    for (const sample of samples) {
      const type = inferVoiceTypeFromFilename(sample);
      if (type) {
        inferredName = type;
        break;
      }
    }
    const newVoiceNames: { [key: number]: string } = {
      1: "",
      2: "",
      3: "",
      4: "",
      ...(kitLabel?.voiceNames || {}),
    };
    newVoiceNames[voice] = inferredName || "";
    const kit = await updateKitLabel((kit) => {
      kit.voiceNames = newVoiceNames;
    });
    await reloadKitLabel();
  };
  const handleRescanAllVoiceNames = async (
    voices: { [key: number]: string[] } | undefined,
  ) => {
    if (!sdCardPath || !kitName) return;
    const safeVoices = voices || { 1: [], 2: [], 3: [], 4: [] };
    const newVoiceNames: { [key: number]: string } = {
      1: "",
      2: "",
      3: "",
      4: "",
    };
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
      newVoiceNames[voice] = inferredName || "";
    }
    const kit = await updateKitLabel((kit) => {
      kit.voiceNames = newVoiceNames;
    });
    await reloadKitLabel();
  };

  const reloadKitLabel = async () => {
    if (!sdCardPath || !kitName) return;
    // @ts-ignore
    const labels: RampleLabels = (await window.electronAPI.readRampleLabels(
      sdCardPath,
    )) || { kits: {} };
    let kit: RampleKitLabel | null = null;
    if (labels && labels.kits && labels.kits[kitName]) {
      kit = labels.kits[kitName];
    } else if (kitName) {
      kit = { label: kitName };
    }
    if (kit) {
      if (!kit.voiceNames) kit.voiceNames = { 1: "", 2: "", 3: "", 4: "" };
    }
    setKitLabel(kit);
  };

  // Save stepPattern to disk and update kitLabel
  const setStepPattern = async (pattern: boolean[][]) => {
    setStepPatternState(pattern);
    if (!sdCardPath || !kitName) return;
    const kit = await updateKitLabel((kit) => {
      kit.stepPattern = pattern;
    });
    setKitLabel({ ...kit });
  };

  return {
    kitLabel,
    setKitLabel,
    labelsLoading,
    labelsError,
    editingKitLabel,
    setEditingKitLabel,
    kitLabelInput,
    setKitLabelInput,
    handleSaveKitLabel,
    handleSaveKitTags,
    handleSaveKitMetadata,
    handleSaveVoiceName,
    handleRescanVoiceName,
    handleRescanAllVoiceNames,
    metadataChanged,
    setMetadataChanged,
    reloadKitLabel,
    stepPattern,
    setStepPattern,
  };
}

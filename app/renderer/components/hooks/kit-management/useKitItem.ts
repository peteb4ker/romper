import type { KnownKitIconType } from "@romper/app/renderer/components/shared/KitIconRenderer";

import { useMemo } from "react";

export function useKitItem(voiceNames?: Record<number | string, string>) {
  const arr = useMemo(
    () =>
      voiceNames
        ? Object.values(voiceNames)
            .filter(
              (v) =>
                typeof v === "string" &&
                v.trim() &&
                v !== "..." &&
                v !== "loading",
            )
            .map((v) => v.toLowerCase())
        : [],
    [voiceNames],
  );
  const unique = useMemo(() => Array.from(new Set(arr)), [arr]);

  const iconType = useMemo((): KnownKitIconType => {
    if (!arr.length) return "folder";
    if (unique.length === 1) {
      if (unique[0] === "vox") return "mic";
      if (unique[0] === "loop") return "loop";
      if (unique[0] === "fx") return "fx";
    }
    if (isSynthOrBass(unique)) {
      return "piano";
    }
    return "drumkit";
  }, [arr, unique]);

  const iconLabel = useMemo(() => {
    if (!arr.length) return "Folder";
    if (unique.length === 1) {
      if (unique[0] === "vox") return "Vocal Kit";
      if (unique[0] === "loop") return "Loop Kit";
      if (unique[0] === "fx") return "FX Kit";
    }
    if (isSynthOrBass(unique)) {
      return "Synth/Bass Kit";
    }
    return "Drum Kit";
  }, [arr, unique]);

  return { iconLabel, iconType };
}

function isSynthOrBass(arr: string[]): boolean {
  return arr.length > 0 && arr.every((v) => v === "synth" || v === "bass");
}

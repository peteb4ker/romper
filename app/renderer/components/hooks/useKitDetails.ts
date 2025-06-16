import { useEffect, useRef } from "react";

import type { RampleKitLabel, VoiceSamples } from "../kitTypes";
import { inferVoiceTypeFromFilename } from "@romper/shared";

export function useKitDetails({
  kitLabel,
  samples,
  sdCardPath,
  kitName,
  onRescanAllVoiceNames,
}: {
  kitLabel?: RampleKitLabel;
  samples: VoiceSamples;
  sdCardPath: string;
  kitName: string;
  onRescanAllVoiceNames?: () => void;
}) {
  // Auto-scan logic
  const scannedRef = useRef(false);
  useEffect(() => {
    if (!kitLabel || !samples) return;
    const allMissing = [1, 2, 3, 4].every((v) => {
      const name = kitLabel.voiceNames?.[v];
      return name === undefined || name === null || name === "";
    });
    const samplesLoaded = [1, 2, 3, 4].some(
      (v) => samples[v] && samples[v].length > 0,
    );
    if (
      allMissing &&
      samplesLoaded &&
      !scannedRef.current &&
      onRescanAllVoiceNames
    ) {
      onRescanAllVoiceNames();
      scannedRef.current = true;
    }
  }, [kitLabel, samples, onRescanAllVoiceNames]);
  useEffect(() => {
    scannedRef.current = false;
  }, [kitName]);

  return {};
}

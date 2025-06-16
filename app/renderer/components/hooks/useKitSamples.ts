import { useEffect, useState } from "react";

import { KitDetailsProps } from "../kitTypes";
import { groupSamplesByVoice, inferVoiceTypeFromFilename } from "../kitUtils";

export function useKitSamples(
  props: KitDetailsProps,
  setKitLabel: (label: any) => void,
) {
  const { kitName, sdCardPath, samples: propSamples } = props;
  const [samples, setSamples] = useState<any>(propSamples || {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voiceNames, setVoiceNames] = useState<{
    [voice: number]: string | null;
  }>({});

  useEffect(() => {
    if (propSamples) {
      setSamples(propSamples);
      setLoading(false);
      setError(null);
    }
  }, [propSamples]);

  useEffect(() => {
    if (propSamples) return;
    const loadSamples = async () => {
      setLoading(true);
      setError(null);
      try {
        // @ts-ignore
        const kitPath = `${sdCardPath}/${kitName}`;
        // @ts-ignore
        const files: string[] =
          await window.electronAPI?.listFilesInRoot?.(kitPath);
        const wavFiles = files.filter((f) => /\.wav$/i.test(f));
        const voices = groupSamplesByVoice(wavFiles);
        setSamples(voices);
        let inferred: { [voice: number]: string | null } = {};
        for (let v = 1; v <= 4; v++) {
          const samplesForVoice = voices[v] || [];
          let inferredName: string | null = null;
          for (const sample of samplesForVoice) {
            const type = inferVoiceTypeFromFilename(sample);
            if (type) {
              inferredName = type;
              break;
            }
          }
          inferred[v] = inferredName;
        }
        setVoiceNames(inferred);
      } catch (e: any) {
        setError("Failed to load kit samples.");
      } finally {
        setLoading(false);
      }
    };
    loadSamples();
  }, [kitName, sdCardPath, propSamples]);

  return { samples, loading, error, voiceNames };
}

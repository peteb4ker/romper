import { useEffect, useState } from "react";

import type { Sample } from "../../../../shared/db/schema";
import { KitDetailsProps } from "../kitTypes";

export function useKitSamples(
  props: KitDetailsProps,
  setKitLabel: (label: any) => void,
) {
  const { kitName, samples: propSamples } = props;
  const [samples, setSamples] = useState<any>({});
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
      return;
    }

    const loadSamples = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!window.electronAPI?.getAllSamplesForKit) {
          throw new Error("Sample loading API not available");
        }

        // Load samples from database
        const samplesResult =
          await window.electronAPI.getAllSamplesForKit(kitName);
        if (!samplesResult.success) {
          throw new Error(
            samplesResult.error || "Failed to load samples from database",
          );
        }

        // Group samples by voice number into the expected format
        const sampleData = samplesResult.data || [];
        const groupedSamples: { [voice: number]: string[] } = {
          1: [],
          2: [],
          3: [],
          4: [],
        };

        sampleData.forEach((sample: Sample) => {
          if (sample.voice_number >= 1 && sample.voice_number <= 4) {
            groupedSamples[sample.voice_number].push(sample.filename);
          }
        });

        setSamples(groupedSamples);

        // Load voice names from kit metadata
        if (window.electronAPI?.getKit) {
          const metadataResult =
            await window.electronAPI.getKit(kitName);
          if (metadataResult.success && metadataResult.data?.voices) {
            // Transform voices array to object format for legacy compatibility
            const voiceNamesObj: { [key: number]: string } = {};
            metadataResult.data.voices.forEach((voice) => {
              if (voice.voice_number && voice.voice_alias) {
                voiceNamesObj[voice.voice_number] = voice.voice_alias;
              }
            });
            setVoiceNames(voiceNamesObj);
          } else {
            setVoiceNames({});
          }
        } else {
          setVoiceNames({});
        }

        setLoading(false);
      } catch (e: any) {
        setError("Failed to load kit samples.");
        setLoading(false);
      }
    };
    loadSamples();
  }, [kitName, propSamples]);

  return { samples, loading, error, voiceNames };
}

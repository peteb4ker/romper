import { useState } from "react";

export function useKitVoicePanel({
  initialSelectedVoice = 1,
  numVoices = 4,
  onVoiceSelect,
}: {
  initialSelectedVoice?: number;
  numVoices?: number;
  onVoiceSelect?: (voice: number) => void;
}) {
  const [selectedVoice, setSelectedVoice] = useState(initialSelectedVoice);

  const selectVoice = (voice: number) => {
    setSelectedVoice(voice);
    if (onVoiceSelect) onVoiceSelect(voice);
  };

  return {
    selectedVoice,
    setSelectedVoice: selectVoice,
  };
}

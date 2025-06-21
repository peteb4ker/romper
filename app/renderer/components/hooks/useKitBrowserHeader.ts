import { useCallback } from "react";

export function useKitBrowserHeader({
  onRescanAllVoiceNames,
  onShowNewKit,
  onCreateNextKit,
  nextKitSlot,
}: {
  onRescanAllVoiceNames: () => void;
  onShowNewKit: () => void;
  onCreateNextKit: () => void;
  nextKitSlot: string | null;
}) {
  const handleRescanAllVoiceNames = useCallback(
    () => onRescanAllVoiceNames(),
    [onRescanAllVoiceNames],
  );
  const handleShowNewKit = useCallback(() => onShowNewKit(), [onShowNewKit]);
  const handleCreateNextKit = useCallback(
    () => onCreateNextKit(),
    [onCreateNextKit],
  );

  return {
    handleRescanAllVoiceNames,
    handleShowNewKit,
    handleCreateNextKit,
    nextKitSlot,
  };
}

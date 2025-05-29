import { useCallback } from 'react';

export function useKitBrowserHeader({
  onSelectSdCard,
  onRescanAllVoiceNames,
  onShowNewKit,
  onCreateNextKit,
  nextKitSlot,
}: {
  onSelectSdCard: () => void;
  onRescanAllVoiceNames: () => void;
  onShowNewKit: () => void;
  onCreateNextKit: () => void;
  nextKitSlot: string | null;
}) {
  // Memoize handlers for performance and testability
  const handleSelectSdCard = useCallback(() => onSelectSdCard(), [onSelectSdCard]);
  const handleRescanAllVoiceNames = useCallback(() => onRescanAllVoiceNames(), [onRescanAllVoiceNames]);
  const handleShowNewKit = useCallback(() => onShowNewKit(), [onShowNewKit]);
  const handleCreateNextKit = useCallback(() => onCreateNextKit(), [onCreateNextKit]);

  return {
    handleSelectSdCard,
    handleRescanAllVoiceNames,
    handleShowNewKit,
    handleCreateNextKit,
    nextKitSlot,
  };
}

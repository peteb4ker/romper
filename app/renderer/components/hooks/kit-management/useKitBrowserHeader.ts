import { useCallback } from "react";

export function useKitBrowserHeader({
  nextKitSlot,
  onCreateNextKit,
  onShowNewKit,
}: {
  nextKitSlot: null | string;
  onCreateNextKit: () => void;
  onShowNewKit: () => void;
}) {
  const handleShowNewKit = useCallback(() => onShowNewKit(), [onShowNewKit]);
  const handleCreateNextKit = useCallback(
    () => onCreateNextKit(),
    [onCreateNextKit],
  );

  return {
    handleCreateNextKit,
    handleShowNewKit,
    nextKitSlot,
  };
}

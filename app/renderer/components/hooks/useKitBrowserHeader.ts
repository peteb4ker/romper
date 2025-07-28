import { useCallback } from "react";

export function useKitBrowserHeader({
  onShowNewKit,
  onCreateNextKit,
  nextKitSlot,
}: {
  onShowNewKit: () => void;
  onCreateNextKit: () => void;
  nextKitSlot: string | null;
}) {
  const handleShowNewKit = useCallback(() => onShowNewKit(), [onShowNewKit]);
  const handleCreateNextKit = useCallback(
    () => onCreateNextKit(),
    [onCreateNextKit],
  );

  return {
    handleShowNewKit,
    handleCreateNextKit,
    nextKitSlot,
  };
}

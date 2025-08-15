import { useCallback } from "react";

export function useKitBrowserHeader({
  onShowNewKit,
}: {
  onShowNewKit: () => void;
}) {
  const handleShowNewKit = useCallback(() => onShowNewKit(), [onShowNewKit]);

  return {
    handleShowNewKit,
  };
}

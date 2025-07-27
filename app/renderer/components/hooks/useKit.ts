import { useCallback, useEffect, useState } from "react";

import type { Kit } from "../../../../shared/db/schema";

export interface UseKitParams {
  kitName: string;
}

/**
 * Hook for loading and managing kit data from database
 */
export function useKit({ kitName }: UseKitParams) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKit = useCallback(async () => {
    if (!window.electronAPI?.getKitMetadata || !kitName) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getKitMetadata(kitName);
      if (result.success && result.data) {
        setKit(result.data);
      } else {
        setKit(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load kit");
    } finally {
      setLoading(false);
    }
  }, [kitName]);

  useEffect(() => {
    if (!kitName) return;
    loadKit();
  }, [kitName, loadKit]);

  const updateKitAlias = async (alias: string) => {
    if (!window.electronAPI?.updateKit || !kitName) return;

    try {
      const result = await window.electronAPI.updateKit(kitName, { alias });
      if (result.success) {
        await loadKit();
      } else {
        setError(result.error || "Failed to update kit alias");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update kit alias");
    }
  };

  return {
    kit,
    loading,
    error,
    reloadKit: loadKit,
    updateKitAlias,
  };
}
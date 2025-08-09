import type { KitWithRelations } from "@romper/shared/db/schema.js";

import { useCallback, useEffect, useState } from "react";

export interface UseKitParams {
  kitName: string;
}

/**
 * Hook for loading and managing kit data from database
 */
export function useKit({ kitName }: UseKitParams) {
  const [kit, setKit] = useState<KitWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

  const loadKit = useCallback(async () => {
    if (!window.electronAPI?.getKit || !kitName) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getKit(kitName);
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

  const toggleEditableMode = async () => {
    if (!window.electronAPI?.updateKit || !kitName || !kit) return;

    const newEditableState = !kit.editable;

    try {
      const result = await window.electronAPI.updateKit(kitName, {
        editable: newEditableState,
      });
      if (result.success) {
        await loadKit();
      } else {
        setError(result.error || "Failed to toggle editable mode");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to toggle editable mode",
      );
    }
  };

  return {
    error,
    kit,
    loading,
    reloadKit: loadKit,
    toggleEditableMode,
    updateKitAlias,
  };
}

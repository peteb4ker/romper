import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { KitBrowserHandle } from "./KitBrowser";

import KitBrowser from "./KitBrowser";

interface KitBrowserContainerProps {
  kits: KitWithRelations[];
  localStorePath: null | string;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onRefreshKits: () => Promise<void>;
  onSelectKit: (kitName: string) => void;
  onShowSettings?: () => void;
  ref?: React.Ref<KitBrowserHandle>;
  sampleCounts: Record<string, [number, number, number, number]>;
  setLocalStorePath: (path: string) => void;
}

/**
 * Container component for KitBrowser
 * Provides memoization and prop optimization
 */
const KitBrowserContainer = React.forwardRef<
  KitBrowserHandle,
  KitBrowserContainerProps
>((props, ref) => {
  const {
    kits,
    localStorePath,
    onMessage,
    onRefreshKits,
    onSelectKit,
    onShowSettings,
    sampleCounts,
    setLocalStorePath,
  } = props;

  // Memoize callbacks to prevent unnecessary re-renders
  const handleMessage = React.useCallback(
    (text: string, type?: string, duration?: number) => {
      onMessage(text, type, duration);
    },
    [onMessage],
  );

  const handleRefreshKits = React.useCallback(async () => {
    await onRefreshKits();
  }, [onRefreshKits]);

  const handleSelectKit = React.useCallback(
    (kitName: string) => {
      onSelectKit(kitName);
    },
    [onSelectKit],
  );

  const handleSetLocalStorePath = React.useCallback(
    (path: string) => {
      setLocalStorePath(path);
    },
    [setLocalStorePath],
  );

  return (
    <KitBrowser
      kits={kits}
      localStorePath={localStorePath}
      onMessage={handleMessage}
      onRefreshKits={handleRefreshKits}
      onSelectKit={handleSelectKit}
      onShowSettings={onShowSettings}
      ref={ref}
      sampleCounts={sampleCounts}
      setLocalStorePath={handleSetLocalStorePath}
    />
  );
});

KitBrowserContainer.displayName = "KitBrowserContainer";

export default React.memo(KitBrowserContainer);

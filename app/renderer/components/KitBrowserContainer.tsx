import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { KitBrowserHandle } from "./KitBrowser";

import KitBrowser from "./KitBrowser";

interface KitBrowserContainerProps {
  // Favorites filter functionality
  favoritesCount?: number;
  getKitFavoriteState?: (kitName: string) => boolean;
  handleToggleFavorite?: (kitName: string) => void;
  handleToggleFavoritesFilter?: () => void;
  handleToggleModifiedFilter?: () => void;
  // Other props
  kits: KitWithRelations[];
  localStorePath: null | string;
  modifiedCount?: number;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onRefreshKits: () => Promise<void>;
  onSelectKit: (kitName: string) => void;
  onShowSettings: () => void;
  ref?: React.Ref<KitBrowserHandle>;
  sampleCounts: Record<string, [number, number, number, number]>;
  setLocalStorePath: (path: string) => void;
  showFavoritesOnly?: boolean;
  showModifiedOnly?: boolean;
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
    // Favorites filter props
    favoritesCount,
    getKitFavoriteState,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    // Other props
    kits,
    localStorePath,
    modifiedCount,
    onMessage,
    onRefreshKits,
    onSelectKit,
    onShowSettings,
    sampleCounts,
    setLocalStorePath,
    showFavoritesOnly,
    showModifiedOnly,
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
      // Favorites filter props
      favoritesCount={favoritesCount}
      getKitFavoriteState={getKitFavoriteState}
      handleToggleFavorite={handleToggleFavorite}
      handleToggleFavoritesFilter={handleToggleFavoritesFilter}
      handleToggleModifiedFilter={handleToggleModifiedFilter}
      // Other props
      kits={kits}
      localStorePath={localStorePath}
      modifiedCount={modifiedCount}
      onMessage={handleMessage}
      onRefreshKits={handleRefreshKits}
      onSelectKit={handleSelectKit}
      onShowSettings={onShowSettings}
      ref={ref}
      sampleCounts={sampleCounts}
      setLocalStorePath={handleSetLocalStorePath}
      showFavoritesOnly={showFavoritesOnly}
      showModifiedOnly={showModifiedOnly}
    />
  );
});

KitBrowserContainer.displayName = "KitBrowserContainer";

export default React.memo(KitBrowserContainer);

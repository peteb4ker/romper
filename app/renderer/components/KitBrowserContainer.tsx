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
  isSearching?: boolean;
  // Other props
  kits: KitWithRelations[];
  localStorePath: null | string;
  modifiedCount?: number;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onRefreshKits: () => Promise<void>;
  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onSelectKit: (kitName: string) => void;
  onShowSettings: () => void;
  ref?: React.Ref<KitBrowserHandle>;
  sampleCounts: Record<string, [number, number, number, number]>;
  // Search functionality
  searchQuery?: string;
  searchResultCount?: number;
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
  console.log("[SEARCH DEBUG] KitBrowserContainer render");
  const {
    // Favorites filter props
    favoritesCount,
    getKitFavoriteState,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    isSearching,
    // Other props
    kits,
    localStorePath,
    modifiedCount,
    onMessage,
    onRefreshKits,
    onSearchChange,
    onSearchClear,
    onSelectKit,
    onShowSettings,
    sampleCounts,
    // Search props
    searchQuery,
    searchResultCount,
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
      isSearching={isSearching}
      // Other props
      kits={kits}
      localStorePath={localStorePath}
      modifiedCount={modifiedCount}
      onMessage={handleMessage}
      onRefreshKits={handleRefreshKits}
      onSearchChange={onSearchChange}
      onSearchClear={onSearchClear}
      onSelectKit={handleSelectKit}
      onShowSettings={onShowSettings}
      ref={ref}
      sampleCounts={sampleCounts}
      // Search props
      searchQuery={searchQuery}
      searchResultCount={searchResultCount}
      setLocalStorePath={handleSetLocalStorePath}
      showFavoritesOnly={showFavoritesOnly}
      showModifiedOnly={showModifiedOnly}
    />
  );
});

KitBrowserContainer.displayName = "KitBrowserContainer";

export default React.memo(KitBrowserContainer);

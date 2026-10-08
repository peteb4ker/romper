import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { BulkScanProgress } from "./hooks/kit-management/useKitScan";

import KitBrowser from "./KitBrowser";

type KitBrowserContainerProps = Readonly<{
  /** Scan All's progress; the scan itself runs in KitsView (RE-43) */
  bulkScanProgress?: BulkScanProgress;
  // Favorites filter functionality
  favoritesCount?: number;
  handleToggleFavorite?: (kitName: string) => void;
  handleToggleFavoritesFilter?: () => void;
  handleToggleModifiedFilter?: () => void;
  isSearching?: boolean;
  // Other props
  kits: KitWithRelations[];
  localStorePath: null | string;
  modifiedCount?: number;
  onAboutClick?: () => void;
  /** Clears a Scan All result that stays because kits failed (#586) */
  onDismissBulkScan?: () => void;
  /** Adds a kit just created or copied, as main returned it (#452) */
  onKitAdded?: (kit: KitWithRelations) => void;
  /** Takes a deleted kit off the list (#452) */
  onKitDeleted?: (kitName: string) => void;
  onMessage: (text: string, type?: string, duration?: number) => void;
  onRefreshKits: () => Promise<void>;
  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onSelectKit: (kitName: string) => void;
  onShowSettings: () => void;
  sampleCounts: Record<string, [number, number, number, number]>;
  // Search functionality
  searchQuery?: string;
  showFavoritesOnly?: boolean;
  showModifiedOnly?: boolean;
}>;

/**
 * Container component for KitBrowser
 * Provides memoization and prop optimization
 */
const KitBrowserContainer: React.FC<KitBrowserContainerProps> = (props) => {
  const {
    bulkScanProgress,
    // Favorites filter props
    favoritesCount,
    handleToggleFavorite,
    handleToggleFavoritesFilter,
    handleToggleModifiedFilter,
    isSearching,
    // Other props
    kits,
    localStorePath,
    modifiedCount,
    onAboutClick,
    onDismissBulkScan,
    onKitAdded,
    onKitDeleted,
    onMessage,
    onRefreshKits,
    onSearchChange,
    onSearchClear,
    onSelectKit,
    onShowSettings,
    sampleCounts,
    // Search props
    searchQuery,
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

  return (
    <KitBrowser
      bulkScanProgress={bulkScanProgress}
      // Favorites filter props
      favoritesCount={favoritesCount}
      handleToggleFavorite={handleToggleFavorite}
      handleToggleFavoritesFilter={handleToggleFavoritesFilter}
      handleToggleModifiedFilter={handleToggleModifiedFilter}
      isSearching={isSearching}
      // Other props
      kits={kits}
      localStorePath={localStorePath}
      modifiedCount={modifiedCount}
      onAboutClick={onAboutClick}
      onDismissBulkScan={onDismissBulkScan}
      onKitAdded={onKitAdded}
      onKitDeleted={onKitDeleted}
      onMessage={handleMessage}
      onRefreshKits={handleRefreshKits}
      onSearchChange={onSearchChange}
      onSearchClear={onSearchClear}
      onSelectKit={handleSelectKit}
      onShowSettings={onShowSettings}
      sampleCounts={sampleCounts}
      // Search props
      searchQuery={searchQuery}
      showFavoritesOnly={showFavoritesOnly}
      showModifiedOnly={showModifiedOnly}
    />
  );
};

KitBrowserContainer.displayName = "KitBrowserContainer";

export default React.memo(KitBrowserContainer);

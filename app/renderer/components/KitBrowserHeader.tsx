import {
  BookmarkSimple,
  DownloadSimple,
  GearSix,
  PencilSimple,
  Star,
} from "@phosphor-icons/react";
import React from "react";

import LedIconGrid from "./led-icon/LedIconGrid";
import SearchInput from "./SearchInput";

interface KitBrowserHeaderProps {
  favoritesCount?: number;
  isSearching?: boolean;
  modifiedCount?: number;
  onAboutClick?: () => void;
  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onShowLocalStoreWizard: () => void;
  onShowSettings: () => void;
  onSyncToSdCard?: () => void;
  onToggleFavoritesFilter?: () => void;
  onToggleModifiedFilter?: () => void;
  searchQuery?: string;
  searchResultCount?: number;
  showFavoritesOnly?: boolean;
  showModifiedOnly?: boolean;
}

const KitBrowserHeader: React.FC<KitBrowserHeaderProps> = (props) => {
  return (
    <div
      className="sticky top-0 z-10 bg-surface-2 px-3 py-2 flex items-center gap-2 border-b border-border-subtle"
      data-testid="kit-browser-header"
    >
      {/* App Icon */}
      <LedIconGrid onClick={props.onAboutClick} />

      {/* Search — fills available space */}
      {props.onSearchChange && (
        <div className="flex-1 min-w-0">
          <SearchInput
            actions={{
              onChange: props.onSearchChange,
              onClear: props.onSearchClear || (() => {}),
            }}
            state={{
              isSearching: props.isSearching || false,
              value: props.searchQuery || "",
            }}
          />
        </div>
      )}

      {/* Favorites Toggle */}
      {props.onToggleFavoritesFilter && (
        <button
          aria-label={
            props.showFavoritesOnly
              ? "Show all kits"
              : "Show only favorite kits"
          }
          className={`flex-shrink-0 px-2.5 py-1.5 text-xs rounded-md transition duration-150 font-medium flex items-center gap-1.5 border ${
            props.showFavoritesOnly
              ? "bg-accent-favorite text-text-inverse border-accent-favorite hover:brightness-110"
              : "border-accent-favorite/40 bg-accent-favorite/5 text-accent-favorite hover:bg-accent-favorite/10"
          }`}
          onClick={props.onToggleFavoritesFilter}
          title={
            props.showFavoritesOnly
              ? "Show all kits"
              : "Show only favorite kits"
          }
        >
          <BookmarkSimple size={14} weight="fill" />
          Favorites
          {typeof props.favoritesCount === "number" &&
            props.favoritesCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] rounded-full font-bold text-center ${
                  props.showFavoritesOnly
                    ? "bg-accent-favorite/80 text-text-inverse"
                    : "bg-accent-favorite/20 text-accent-favorite"
                }`}
              >
                {props.favoritesCount}
              </span>
            )}
        </button>
      )}

      {/* Modified Toggle */}
      {props.onToggleModifiedFilter && (
        <button
          aria-label={
            props.showModifiedOnly ? "Show all kits" : "Show only modified kits"
          }
          className={`flex-shrink-0 px-2.5 py-1.5 text-xs rounded-md transition duration-150 font-medium flex items-center gap-1.5 border ${
            props.showModifiedOnly
              ? "bg-accent-warning text-text-inverse border-accent-warning hover:brightness-110"
              : "border-accent-warning/40 bg-accent-warning/5 text-accent-warning hover:bg-accent-warning/10"
          }`}
          onClick={props.onToggleModifiedFilter}
          title={
            props.showModifiedOnly
              ? "Show all kits"
              : "Show only modified kits with unsaved changes"
          }
        >
          Modified
          {typeof props.modifiedCount === "number" &&
            props.modifiedCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] rounded-full font-bold text-center ${
                  props.showModifiedOnly
                    ? "bg-accent-warning/80 text-text-inverse"
                    : "bg-accent-warning/20 text-accent-warning"
                }`}
              >
                {props.modifiedCount}
              </span>
            )}
        </button>
      )}

      {/* Divider */}
      <div className="h-5 border-l border-border-subtle flex-shrink-0" />

      {/* Sync */}
      {props.onSyncToSdCard && (
        <button
          className="flex-shrink-0 px-2.5 py-1.5 text-xs border border-border-default text-text-secondary rounded-md hover:bg-surface-3 transition-colors duration-150 font-medium flex items-center gap-1"
          data-testid="sync-to-sd-card"
          onClick={props.onSyncToSdCard}
          title="Sync modified kits to SD card"
        >
          <DownloadSimple size={12} />
          Sync
        </button>
      )}

      {/* Settings */}
      <button
        aria-label="Settings"
        className="flex-shrink-0 p-2 rounded-md text-text-secondary hover:bg-surface-3 transition-colors duration-150"
        onClick={props.onShowSettings}
        title="Configure settings and preferences"
      >
        <GearSix size={16} />
      </button>
    </div>
  );
};

export default KitBrowserHeader;

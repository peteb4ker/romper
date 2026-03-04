import {
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
    <div className="sticky top-0 z-10 bg-surface-2 px-3 py-2 flex items-center gap-2 border-b border-border-subtle">
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
          className={`flex-shrink-0 px-2.5 py-1.5 text-xs rounded-md transition duration-150 font-medium flex items-center gap-1.5 ${
            props.showFavoritesOnly
              ? "bg-accent-warning text-text-inverse hover:brightness-110"
              : "text-text-secondary hover:bg-surface-3"
          }`}
          onClick={props.onToggleFavoritesFilter}
          title={
            props.showFavoritesOnly
              ? "Show all kits"
              : "Show only favorite kits"
          }
        >
          <Star size={14} weight="fill" />
          Favorites
          {typeof props.favoritesCount === "number" &&
            props.favoritesCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] rounded-full font-bold text-center ${
                  props.showFavoritesOnly
                    ? "bg-accent-warning/80 text-text-inverse"
                    : "bg-surface-4 text-text-secondary"
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
          className={`flex-shrink-0 px-2.5 py-1.5 text-xs rounded-md transition duration-150 font-medium flex items-center gap-1.5 ${
            props.showModifiedOnly
              ? "bg-accent-warning text-text-inverse hover:brightness-110"
              : "text-text-secondary hover:bg-surface-3"
          }`}
          onClick={props.onToggleModifiedFilter}
          title={
            props.showModifiedOnly
              ? "Show all kits"
              : "Show only modified kits with unsaved changes"
          }
        >
          <PencilSimple size={14} />
          Modified
          {typeof props.modifiedCount === "number" &&
            props.modifiedCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] rounded-full font-bold text-center ${
                  props.showModifiedOnly
                    ? "bg-accent-warning/80 text-text-inverse"
                    : "bg-surface-4 text-text-secondary"
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

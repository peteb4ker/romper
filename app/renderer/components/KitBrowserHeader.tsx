import {
  CheckCircle,
  DownloadSimple,
  GearSix,
  PencilSimple,
  Star,
} from "@phosphor-icons/react";
import React from "react";

import { useKitBrowserHeader } from "./hooks/kit-management/useKitBrowserHeader";
import SearchInput from "./SearchInput";

interface KitBrowserHeaderProps {
  favoritesCount?: number;
  isSearching?: boolean;
  modifiedCount?: number;
  onSearchChange?: (query: string) => void;
  onSearchClear?: () => void;
  onShowLocalStoreWizard: () => void;
  onShowNewKit: () => void; // Used by useKitBrowserHeader hook
  onShowSettings: () => void;
  onSyncToSdCard?: () => void;
  onToggleFavoritesFilter?: () => void;
  onToggleModifiedFilter?: () => void;

  onValidateLocalStore: () => void;
  // Search props
  searchQuery?: string;
  searchResultCount?: number;
  // Task 20.1.4: Favorites filter props
  showFavoritesOnly?: boolean;
  // Task 20.2.2: Additional filter props
  showModifiedOnly?: boolean;
}

const KitBrowserHeader: React.FC<KitBrowserHeaderProps> = (props) => {
  const { handleShowNewKit } = useKitBrowserHeader(props);

  return (
    <div className="sticky top-0 z-10 bg-surface-2 p-2 flex flex-col gap-2 items-stretch justify-between shadow-sm border-b border-border-subtle">
      <div className="flex items-center justify-between w-full gap-4">
        {/* Left: Sync and New Kit */}
        <div className="flex items-center gap-2">
          {props.onSyncToSdCard && (
            <button
              className="px-3 py-2 text-xs bg-accent-sync text-text-inverse rounded shadow-sm hover:brightness-110 transition-colors duration-150 font-medium flex items-center gap-1.5"
              data-testid="sync-to-sd-card"
              onClick={props.onSyncToSdCard}
              title="Sync modified kits to SD card"
            >
              <DownloadSimple size={14} />
              Sync to SD Card
            </button>
          )}
          <button
            className="px-3 py-2 text-xs bg-accent-primary text-text-inverse rounded shadow-sm hover:brightness-110 transition-colors duration-150 font-medium"
            onClick={handleShowNewKit}
          >
            + New Kit
          </button>
        </div>

        {/* Center: Search Input */}
        {props.onSearchChange && (
          <div className="flex-1 flex justify-center">
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

        {/* Right: Filters and Settings */}
        <div className="flex items-center gap-2">
          {props.onToggleFavoritesFilter && (
            <button
              className={`px-3 py-2 text-xs rounded shadow-sm transition duration-150 font-medium flex items-center gap-1.5 ${
                props.showFavoritesOnly
                  ? "bg-accent-warning text-text-inverse hover:brightness-110"
                  : "bg-surface-3 text-text-secondary hover:bg-surface-4"
              }`}
              onClick={props.onToggleFavoritesFilter}
              title={
                props.showFavoritesOnly
                  ? "Show all kits"
                  : "Show only favorite kits"
              }
            >
              <Star size={12} weight="fill" />
              <span>Favorites</span>
              {typeof props.favoritesCount === "number" && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
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

          {props.onToggleModifiedFilter && (
            <button
              className={`px-3 py-2 text-xs rounded shadow-sm transition duration-150 font-medium flex items-center gap-1.5 ${
                props.showModifiedOnly
                  ? "bg-accent-warning text-text-inverse hover:brightness-110"
                  : "bg-surface-3 text-text-secondary hover:bg-surface-4"
              }`}
              onClick={props.onToggleModifiedFilter}
              title={
                props.showModifiedOnly
                  ? "Show all kits"
                  : "Show only modified kits with unsaved changes"
              }
            >
              <PencilSimple size={12} />
              <span>Modified</span>
              {typeof props.modifiedCount === "number" && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
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
        </div>

        {/* Right: System Actions */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 text-xs bg-surface-3 text-text-primary rounded shadow-sm hover:bg-surface-4 transition-colors duration-150 font-medium flex items-center gap-1.5"
            onClick={props.onValidateLocalStore}
            title="Validate local store and database consistency"
          >
            <CheckCircle size={14} />
            Validate Store
          </button>
          <button
            aria-label="Settings"
            className="px-3 py-2 text-xs bg-surface-3 text-text-primary rounded shadow-sm hover:bg-surface-4 transition-colors duration-150 font-medium flex items-center gap-1.5"
            onClick={props.onShowSettings}
            title="Configure settings and preferences"
          >
            <GearSix size={14} />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitBrowserHeader;

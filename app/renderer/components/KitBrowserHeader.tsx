import React from "react";
import { FaStar } from "react-icons/fa";
import { FiCheckCircle, FiDownload, FiEdit3, FiSettings } from "react-icons/fi";

import { useKitBrowserHeader } from "./hooks/kit-management/useKitBrowserHeader";
import SearchInput from "./SearchInput";

interface KitBrowserHeaderProps {
  bankNav?: React.ReactNode;
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
  const { bankNav } = props;

  return (
    <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800 pt-2 pr-2 pl-2 pb-0 flex flex-col gap-2 items-stretch justify-between shadow-sm border-b border-gray-200 dark:border-slate-700 mt-0">
      <div className="flex items-center justify-between w-full gap-4">
        {/* Left: Sync and New Kit */}
        <div className="flex items-center gap-3">
          {props.onSyncToSdCard && (
            <button
              className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded shadow-sm hover:bg-orange-700 transition-colors font-semibold flex items-center gap-1.5"
              data-testid="sync-to-sd-card"
              onClick={props.onSyncToSdCard}
              title="Sync modified kits to SD card"
            >
              <FiDownload className="w-3.5 h-3.5" />
              Sync to SD Card
            </button>
          )}
          <button
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition-colors font-semibold"
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
                resultCount: props.searchResultCount || 0,
                value: props.searchQuery || "",
              }}
            />
          </div>
        )}

        {/* Right: Filters and Settings */}
        <div className="flex items-center gap-2">
          {props.onToggleFavoritesFilter && (
            <button
              className={`px-3 py-1.5 text-xs rounded shadow-sm transition flex items-center gap-1.5 ${
                props.showFavoritesOnly
                  ? "bg-yellow-500 text-white hover:bg-yellow-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              onClick={props.onToggleFavoritesFilter}
              title={
                props.showFavoritesOnly
                  ? "Show all kits"
                  : "Show only favorite kits"
              }
            >
              <FaStar className="w-3 h-3" />
              <span>Favorites</span>
              {typeof props.favoritesCount === "number" && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                    props.showFavoritesOnly
                      ? "bg-yellow-600 text-yellow-100"
                      : "bg-gray-400 dark:bg-gray-600 text-white"
                  }`}
                >
                  {props.favoritesCount}
                </span>
              )}
            </button>
          )}

          {props.onToggleModifiedFilter && (
            <button
              className={`px-3 py-1.5 text-xs rounded shadow-sm transition flex items-center gap-1.5 ${
                props.showModifiedOnly
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
              onClick={props.onToggleModifiedFilter}
              title={
                props.showModifiedOnly
                  ? "Show all kits"
                  : "Show only modified kits with unsaved changes"
              }
            >
              <FiEdit3 className="w-3 h-3" />
              <span>Modified</span>
              {typeof props.modifiedCount === "number" && (
                <span
                  className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                    props.showModifiedOnly
                      ? "bg-amber-600 text-amber-100"
                      : "bg-gray-400 dark:bg-gray-600 text-white"
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
            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded shadow-sm hover:bg-gray-700 transition-colors font-medium flex items-center gap-1.5"
            onClick={props.onValidateLocalStore}
            title="Validate local store and database consistency"
          >
            <FiCheckCircle className="w-3.5 h-3.5" />
            Validate Store
          </button>
          <button
            aria-label="Settings"
            className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded shadow-sm hover:bg-gray-700 transition-colors font-medium flex items-center gap-1.5"
            onClick={props.onShowSettings}
            title="Configure settings and preferences"
          >
            <FiSettings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {/* BankNav row (A-Z buttons) */}
      {bankNav && (
        <div className="w-full flex justify-center mt-1">{bankNav}</div>
      )}
    </div>
  );
};

export default KitBrowserHeader;

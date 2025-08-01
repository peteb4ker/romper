import React from "react";
import { FaStar } from "react-icons/fa";
import { FiDatabase, FiDownload, FiEdit3, FiRefreshCw } from "react-icons/fi";

import { useKitBrowserHeader } from "./hooks/useKitBrowserHeader";

interface KitBrowserHeaderProps {
  onScanAllKits?: () => void;
  onShowNewKit: () => void;
  onCreateNextKit: () => void;
  nextKitSlot: string | null;
  bankNav?: React.ReactNode;
  onShowLocalStoreWizard: () => void;
  onValidateLocalStore: () => void;
  onSyncToSdCard?: () => void;
  // Task 20.1.4: Favorites filter props
  showFavoritesOnly?: boolean;
  onToggleFavoritesFilter?: () => void;
  favoritesCount?: number;
  // Task 20.2.2: Additional filter props
  showModifiedOnly?: boolean;
  onToggleModifiedFilter?: () => void;
  modifiedCount?: number;
  showRecentOnly?: boolean;
  onToggleRecentFilter?: () => void;
  recentCount?: number;
}

const KitBrowserHeader: React.FC<KitBrowserHeaderProps> = (props) => {
  const { handleShowNewKit, handleCreateNextKit, nextKitSlot } =
    useKitBrowserHeader(props);
  const { bankNav } = props;

  return (
    <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800 pt-2 pr-2 pl-2 pb-0 flex flex-col gap-2 items-stretch justify-between shadow-sm border-b border-gray-200 dark:border-slate-700 mt-0">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          {/* Scanning operations */}
          {props.onScanAllKits && (
            <button
              className="px-2 py-1 text-xs bg-green-500 text-white rounded shadow hover:bg-green-700 font-semibold flex items-center"
              onClick={() => props.onScanAllKits && props.onScanAllKits()}
              title="Perform comprehensive scan on all kits (voice names, WAV analysis, artist metadata)"
            >
              <FiRefreshCw className="inline-block mr-1" />
              Scan All Kits
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {/* Kit creation */}
          <button
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition font-semibold"
            onClick={handleShowNewKit}
          >
            + New Kit
          </button>
          <button
            className="px-2 py-1 text-xs bg-green-600 text-white rounded shadow hover:bg-green-700 transition font-semibold"
            onClick={handleCreateNextKit}
            disabled={!nextKitSlot}
          >
            + Next Kit
          </button>

          {/* Sync operations */}
          {props.onSyncToSdCard && (
            <button
              className="px-2 py-1 text-xs bg-orange-600 text-white rounded shadow hover:bg-orange-700 transition font-semibold flex items-center"
              onClick={props.onSyncToSdCard}
              title="Sync modified kits to SD card"
            >
              <FiDownload className="inline-block mr-1" />
              Sync to SD Card
            </button>
          )}

          {/* Validation and maintenance */}
          <button
            className="px-2 py-1 text-xs bg-teal-600 text-white rounded shadow hover:bg-teal-700 transition font-semibold"
            onClick={props.onValidateLocalStore}
            title="Validate local store and database consistency"
          >
            <FiDatabase className="inline-block mr-1" />
            Validate Local Store
          </button>
          <button
            className="px-2 py-1 text-xs bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition font-semibold"
            onClick={props.onShowLocalStoreWizard}
            aria-label="Local Store Setup"
          >
            Local Store Setup
          </button>
        </div>
      </div>
      {/* Task 20.1.4 & 20.2.2: Filter row */}
      <div className="flex items-center justify-center gap-2 mt-1">
        {props.onToggleFavoritesFilter && (
          <button
            className={`px-3 py-1 text-xs rounded shadow transition flex items-center gap-1 ${
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
            <FaStar className="text-xs" />
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

        {/* Task 20.2.2: Modified filter */}
        {props.onToggleModifiedFilter && (
          <button
            className={`px-3 py-1 text-xs rounded shadow transition flex items-center gap-1 ${
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
            <FiEdit3 className="text-xs" />
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

        {/* Task 20.2.2: Recent filter - commented out for now, can be implemented later
        {props.onToggleRecentFilter && (
          <button
            className={`px-3 py-1 text-xs rounded shadow transition flex items-center gap-1 ${
              props.showRecentOnly
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
            onClick={props.onToggleRecentFilter}
            title={props.showRecentOnly ? "Show all kits" : "Show only recently accessed kits"}
          >
            <FiClock className="text-xs" />
            <span>Recent</span>
            {typeof props.recentCount === "number" && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                props.showRecentOnly
                  ? "bg-blue-600 text-blue-100"
                  : "bg-gray-400 dark:bg-gray-600 text-white"
              }`}>
                {props.recentCount}
              </span>
            )}
          </button>
        )} */}
      </div>

      {/* BankNav row (A-Z buttons) */}
      {bankNav && (
        <div className="w-full flex justify-center mt-1">{bankNav}</div>
      )}
    </div>
  );
};

export default KitBrowserHeader;

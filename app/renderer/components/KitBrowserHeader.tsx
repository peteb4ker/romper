import React, { useState } from "react";
import { FiDatabase, FiDownload, FiRefreshCw } from "react-icons/fi";

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
      {/* BankNav row (A-Z buttons) */}
      {bankNav && (
        <div className="w-full flex justify-center mt-1">{bankNav}</div>
      )}
    </div>
  );
};

export default KitBrowserHeader;

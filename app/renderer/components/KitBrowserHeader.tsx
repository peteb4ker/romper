import React, { useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import { useKitBrowserHeader } from "./hooks/useKitBrowserHeader";

interface KitBrowserHeaderProps {
  onRescanAllVoiceNames: () => void;
  onScanAllKits?: () => void;
  onShowNewKit: () => void;
  onCreateNextKit: () => void;
  nextKitSlot: string | null;
  bankNav?: React.ReactNode;
  onShowLocalStoreWizard: () => void;
}

const KitBrowserHeader: React.FC<KitBrowserHeaderProps> = (props) => {
  const {
    handleRescanAllVoiceNames,
    handleShowNewKit,
    handleCreateNextKit,
    nextKitSlot,
  } = useKitBrowserHeader(props);
  const { bankNav } = props;
  return (
    <div className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800 pt-2 pr-2 pl-2 pb-0 flex flex-col gap-2 items-stretch justify-between shadow-sm border-b border-gray-200 dark:border-slate-700 mt-0">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded shadow hover:bg-blue-700 font-semibold"
            onClick={handleRescanAllVoiceNames}
          >
            Rescan All Kit Voice Names
          </button>
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

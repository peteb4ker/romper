import React from "react";
import { FiEdit3, FiEye, FiUploadCloud } from "react-icons/fi";

import { useInterfaceMode } from "../contexts/InterfaceModeContext";

const InterfaceModeSwitch: React.FC = () => {
  const { mode, setMode, isBrowseMode, isEditMode, isSyncMode } =
    useInterfaceMode();

  return (
    <div className="flex items-center gap-1 bg-gray-200 dark:bg-slate-700 rounded-lg p-1">
      {/* Browse Mode */}
      <button
        onClick={() => setMode("browse")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isBrowseMode
            ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
        title="Browse Mode - Preview and explore kits"
      >
        <FiEye className="text-base" />
        <span>Browse</span>
      </button>

      {/* Edit Mode */}
      <button
        onClick={() => setMode("edit")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isEditMode
            ? "bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
        title="Edit Mode - Modify kits and manage samples"
      >
        <FiEdit3 className="text-base" />
        <span>Edit</span>
      </button>

      {/* Sync Mode */}
      <button
        onClick={() => setMode("sync")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isSyncMode
            ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
        title="Sync Mode - Sync kits to SD card"
      >
        <FiUploadCloud className="text-base" />
        <span>Sync</span>
      </button>
    </div>
  );
};

export default InterfaceModeSwitch;

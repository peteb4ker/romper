import React, { useState } from "react";
import { FaFolderOpen } from "react-icons/fa";

import FilePickerButton from "../utils/FilePickerButton";

interface WizardTargetStepProps {
  stateTargetPath: string;
  defaultPath: string;
  setTargetPath: (path: string) => void;
  safeSelectLocalStorePath: (() => Promise<string | undefined>) | undefined;
}

const WizardTargetStep: React.FC<WizardTargetStepProps> = ({
  stateTargetPath,
  defaultPath,
  setTargetPath,
  safeSelectLocalStorePath,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleChooseFolder = async () => {
    if (!safeSelectLocalStorePath) {
      throw new Error("selectLocalStorePath is not available");
    }

    setIsSelecting(true);
    try {
      let path = await safeSelectLocalStorePath();
      if (path) {
        if (!/romper\/?$/.test(path)) {
          path = path.replace(/\/+$|\\+$/, "") + "/romper";
        }
        setTargetPath(path);
      }
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="mb-4">
      <label
        className="block font-semibold mb-1"
        htmlFor="local-store-path-input"
      >
        Choose target
      </label>
      <div className="flex gap-2 items-center">
        <input
          id="local-store-path-input"
          type="text"
          className="border rounded px-2 py-1 w-full mb-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
          value={stateTargetPath}
          placeholder={defaultPath}
          onChange={(e) => setTargetPath(e.target.value)}
          aria-label="Local store path"
        />
        <FilePickerButton
          className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleChooseFolder}
          isSelecting={isSelecting}
          icon={<FaFolderOpen size={14} />}
        >
          Choose…
        </FilePickerButton>
        <button
          type="button"
          className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setTargetPath(defaultPath)}
          aria-label="Use default folder"
        >
          Use Default
        </button>
      </div>
    </div>
  );
};

export default WizardTargetStep;

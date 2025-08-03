import React, { useState } from "react";
import { FaFolderOpen } from "react-icons/fa";

import FilePickerButton from "../utils/FilePickerButton";

interface WizardTargetStepProps {
  defaultPath: string;
  safeSelectLocalStorePath: (() => Promise<string | undefined>) | undefined;
  setTargetPath: (path: string) => void;
  stateTargetPath: string;
}

const WizardTargetStep: React.FC<WizardTargetStepProps> = ({
  defaultPath,
  safeSelectLocalStorePath,
  setTargetPath,
  stateTargetPath,
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
          aria-label="Local store path"
          className="border rounded px-2 py-1 w-full mb-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
          id="local-store-path-input"
          onChange={(e) => setTargetPath(e.target.value)}
          placeholder={defaultPath}
          type="text"
          value={stateTargetPath}
        />
        <FilePickerButton
          className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          icon={<FaFolderOpen size={14} />}
          isSelecting={isSelecting}
          onClick={handleChooseFolder}
        >
          Choose…
        </FilePickerButton>
        <button
          aria-label="Use default folder"
          className="bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 px-2 py-1 rounded ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setTargetPath(defaultPath)}
          type="button"
        >
          Use Default
        </button>
      </div>
    </div>
  );
};

export default WizardTargetStep;

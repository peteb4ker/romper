import React, { useState } from "react";
import { FiExternalLink } from "react-icons/fi";

import { formatSamplePath } from "../utils/sampleLocationUtils";

interface SampleLocationLabelProps {
  path: string;
  className?: string;
  showIcon?: boolean;
  onShowInFinder?: (path: string) => void;
}

const SampleLocationLabel: React.FC<SampleLocationLabelProps> = ({
  path,
  className = "",
  showIcon = true,
  onShowInFinder,
}) => {
  const [showFullPath, setShowFullPath] = useState(false);
  const { short, full, location } = formatSamplePath(path);
  const Icon = location.icon;

  return (
    <div
      className={`group relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={() => setShowFullPath(true)}
      onMouseLeave={() => setShowFullPath(false)}
    >
      {showIcon && (
        <Icon
          className="text-xs text-gray-500 dark:text-gray-400"
          title={location.description}
        />
      )}

      <span className="text-xs text-gray-600 dark:text-gray-400">{short}</span>

      {/* Progressive disclosure: show full path on hover */}
      {showFullPath && (
        <div className="absolute bottom-full left-0 mb-1 z-50 pointer-events-none">
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
            <div className="font-mono text-[10px] mb-1">{full}</div>
            <div className="text-gray-300 italic">{location.description}</div>
          </div>
        </div>
      )}

      {/* Show in Finder/Explorer button on hover */}
      {onShowInFinder && showFullPath && (
        <button
          className="ml-1 p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onShowInFinder(path);
          }}
          title="Show in Finder"
        >
          <FiExternalLink className="text-xs" />
        </button>
      )}
    </div>
  );
};

export default SampleLocationLabel;

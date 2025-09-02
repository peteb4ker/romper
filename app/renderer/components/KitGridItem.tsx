import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";
import { FaStar } from "react-icons/fa";
import { FiCopy } from "react-icons/fi";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";

interface KitGridItemProps extends BaseKitItemProps {}

// Add ref forwarding and selection props
const KitGridItem = React.memo(
  React.forwardRef<HTMLDivElement, KitGridItemProps & KitItemRenderProps>(
    (
      {
        isFavorite: isFavoriteProp,
        isSelected,
        isValid,
        kit,
        kitData,
        onDuplicate,
        onSelect,
        onToggleFavorite,
        sampleCounts,
        ...rest
      },
      ref,
    ) => {
      // Extract voice names using shared utility
      const voiceNames = extractVoiceNames(kitData);

      const { iconLabel, iconType } = useKitItem(voiceNames);

      // Use shared icon renderer with medium size for grid view
      const icon = <KitIconRenderer iconType={iconType} size="md" />;

      // Use direct prop value or fallback to kit data
      const isFavorite = isFavoriteProp ?? kitData?.is_favorite ?? false;

      // Kit type visual identification borders and backgrounds
      const getKitTypeStyles = () => {
        if (!isValid) {
          return {
            background: "bg-red-50 dark:bg-red-950",
            border: "border-l-4 border-l-red-500",
          };
        }

        // Check if kit has unsaved changes (modified since sync)
        if (kitData?.modified_since_sync) {
          return {
            background: "bg-amber-50 dark:bg-amber-950",
            border: "border-l-4 border-l-amber-500",
          };
        }

        // Check if kit is editable (user-created)
        if (kitData?.editable) {
          return {
            background: "bg-green-50 dark:bg-green-950",
            border: "border-l-4 border-l-green-500",
          };
        }

        // Factory kits (read-only baseline)
        return {
          background: "bg-gray-50 dark:bg-gray-900",
          border: "border-l-4 border-l-gray-400",
        };
      };

      const kitTypeStyles = getKitTypeStyles();

      // Task 20.2.1: Determine if kit is high priority
      const isHighPriority = () => {
        if (!isValid || !kitData) return false;

        // High priority conditions:
        // 1. Favorite kits (user marked as important)
        // 2. Modified kits with unsaved changes (need attention)
        // 3. Well-loaded kits (high sample count across voices - useful for performance)
        const wellLoaded =
          sampleCounts &&
          sampleCounts.filter((count) => count >= 8).length >= 2;

        return kitData.is_favorite || kitData.modified_since_sync || wellLoaded;
      };

      // Selection highlighting
      const selectedHighlight = isSelected
        ? "ring-2 ring-blue-400 dark:ring-blue-300 border-blue-400 dark:border-blue-300 bg-blue-50 dark:bg-blue-900"
        : "";

      // Calculate sample count for aria-label
      const totalSamples =
        (sampleCounts?.[0] || 0) +
        (sampleCounts?.[1] || 0) +
        (sampleCounts?.[2] || 0) +
        (sampleCounts?.[3] || 0);
      const statusText = !isValid ? "Invalid kit" : `${totalSamples} samples`;
      const ariaLabel = `Kit ${kit} - ${statusText}`;

      // vertical card layout with optimized spacing
      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`relative flex flex-col justify-between p-2 rounded border text-sm h-full w-full ${kitTypeStyles.border} ${kitTypeStyles.background} ${
            isValid
              ? "border-gray-300 dark:border-slate-700 hover:brightness-95 dark:hover:brightness-110"
              : "border-red-500"
          } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300 ${selectedHighlight}`}
          data-kit={kit}
          data-testid={`kit-item-${kit}`}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          ref={ref}
          role="option"
          tabIndex={isSelected ? 0 : -1}
          {...rest}
        >
          {/* Task 20.2.1: High priority indicator */}
          {isHighPriority() && (
            <div
              className="absolute top-1 left-1 w-2 h-2 bg-orange-500 rounded-full shadow-sm border border-orange-600"
              title="High priority kit (favorite, modified, or well-loaded)"
            />
          )}
          {/* Top row: icon, kit name, status badges */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span title={iconLabel}>{icon}</span>
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={`font-mono text-sm truncate ${
                    isValid
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-red-500"
                  }`}
                >
                  {kit}
                </span>
                {kitData?.alias && (
                  <span
                    className="text-xs text-gray-600 dark:text-gray-400 truncate italic"
                    title={`Kit alias: ${kitData.alias}`}
                  >
                    {kitData.alias}
                  </span>
                )}
              </div>
            </div>

            {/* Search match indicators - compact badges */}
            {isValid && kitData?.searchMatch && (
              <div className="flex flex-wrap gap-1 mt-1">
                {kitData.searchMatch.matchedSamples.length > 0 && (
                  <span
                    className="px-1 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded border border-green-300 dark:border-green-700 font-mono truncate max-w-full cursor-help"
                    title={`Sample matches:\n${kitData.searchMatch.matchedSamples.join("\n")}`}
                  >
                    📄
                    {kitData.searchMatch.matchedSamples.length > 1
                      ? ` ${kitData.searchMatch.matchedSamples.length}`
                      : ""}
                  </span>
                )}
                {kitData.searchMatch.matchedArtist && (
                  <span className="px-1 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded border border-purple-300 dark:border-purple-700 font-mono truncate">
                    🎵 {kitData.searchMatch.matchedArtist}
                  </span>
                )}
                {kitData.searchMatch.matchedAlias && (
                  <span className="px-1 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded border border-blue-300 dark:border-blue-700 font-mono truncate">
                    🏷️ {kitData.searchMatch.matchedAlias}
                  </span>
                )}
              </div>
            )}

            {/* Enhanced Status indicators */}
            <div className="flex items-center gap-1">
              {isValid && kitData?.modified_since_sync && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded border border-amber-300 dark:border-amber-700">
                  Unsaved
                </span>
              )}
              {isValid &&
                kitData?.editable &&
                !kitData?.modified_since_sync && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded border border-green-300 dark:border-green-700">
                    Editable
                  </span>
                )}
              {/* Favorite toggle button */}
              {onToggleFavorite && (
                <button
                  className={`p-1 text-xs ml-1 transition-colors ${
                    isFavorite
                      ? "text-yellow-500 hover:text-yellow-600"
                      : "text-gray-400 hover:text-yellow-500"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleFavorite(kit);
                  }}
                  title={
                    isFavorite ? "Remove from favorites" : "Add to favorites"
                  }
                >
                  <FaStar
                    className={`w-4 h-4 ${isFavorite ? "" : "opacity-30"}`}
                  />
                </button>
              )}
              {isValid && (
                <button
                  className="p-1 text-xs text-gray-500 hover:text-green-600 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  title="Duplicate kit"
                >
                  <FiCopy />
                </button>
              )}
            </div>
          </div>

          {/* Voice indicators: Unified voice names and sample counts */}
          {isValid && sampleCounts && (
            <div className="flex items-end gap-1 w-full">
              {sampleCounts.map((count, idx) => {
                const voiceNumber = idx + 1;
                const voiceName = voiceNames?.[voiceNumber];

                // Color coding for sample counts
                let color = "";
                let fontWeight = "";
                if (count === 0) {
                  color =
                    "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800";
                } else if (count === 12) {
                  color =
                    "bg-lime-300 dark:bg-lime-700 text-lime-900 dark:text-lime-100 border border-lime-400 dark:border-lime-600";
                  fontWeight = "font-bold";
                } else {
                  color =
                    "bg-teal-300 dark:bg-teal-800 text-teal-900 dark:text-teal-100 border border-teal-400 dark:border-teal-700";
                }

                // Unified label: voice name + count, or just count
                const voiceDisplayName =
                  typeof voiceName === "string"
                    ? toCapitalCase(voiceName)
                    : voiceName;
                const displayText = voiceName
                  ? `${voiceDisplayName} ${count}`
                  : count.toString();

                return (
                  <div
                    className="w-1/4 flex justify-center"
                    key={`voice-${voiceNumber}`}
                    title={
                      `Voice ${voiceNumber}: ${count} samples` +
                      (voiceName ? ` (${voiceName})` : "")
                    }
                  >
                    <span
                      className={`px-1 py-1 rounded text-xs font-mono ${color} ${fontWeight} text-center truncate w-full max-w-full`}
                    >
                      {displayText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    },
  ),
);

KitGridItem.displayName = "KitGridItem";
export default KitGridItem;

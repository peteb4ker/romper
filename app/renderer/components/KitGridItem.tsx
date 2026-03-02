import { Copy, Star } from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

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
            background: "bg-accent-danger/5",
            border: "border-l-4 border-l-accent-danger",
          };
        }

        // Check if kit has unsaved changes (modified since sync)
        if (kitData?.modified_since_sync) {
          return {
            background: "bg-accent-warning/5",
            border: "border-l-4 border-l-accent-warning",
          };
        }

        // Check if kit is editable (user-created)
        if (kitData?.editable) {
          return {
            background: "bg-accent-success/5",
            border: "border-l-4 border-l-accent-success",
          };
        }

        // Factory kits (read-only baseline)
        return {
          background: "bg-surface-2",
          border: "border-l-4 border-l-border-strong",
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
        ? "ring-2 ring-accent-primary border-accent-primary bg-accent-primary/10"
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
              ? "border-border-subtle hover:brightness-95 dark:hover:brightness-110"
              : "border-accent-danger"
          } cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${selectedHighlight}`}
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
              className="absolute top-1 left-1 w-2 h-2 bg-accent-warning rounded-full shadow-sm border border-accent-warning/80"
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
                    isValid ? "text-text-primary" : "text-accent-danger"
                  }`}
                >
                  {kit}
                </span>
                {kitData?.alias && (
                  <span
                    className="text-xs text-text-secondary truncate italic"
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
                    className="px-1 py-0.5 text-xs bg-accent-success/15 text-accent-success rounded border border-accent-success/30 font-mono truncate max-w-full cursor-help"
                    title={`Sample matches:\n${kitData.searchMatch.matchedSamples.join("\n")}`}
                  >
                    📄
                    {kitData.searchMatch.matchedSamples.length > 1
                      ? ` ${kitData.searchMatch.matchedSamples.length}`
                      : ""}
                  </span>
                )}
                {kitData.searchMatch.matchedArtist && (
                  <span className="px-1 py-0.5 text-xs bg-voice-3-muted text-voice-3 rounded border border-voice-3/30 font-mono truncate">
                    🎵 {kitData.searchMatch.matchedArtist}
                  </span>
                )}
                {kitData.searchMatch.matchedAlias && (
                  <span className="px-1 py-0.5 text-xs bg-accent-primary/15 text-accent-primary rounded border border-accent-primary/30 font-mono truncate">
                    🏷️ {kitData.searchMatch.matchedAlias}
                  </span>
                )}
              </div>
            )}

            {/* Enhanced Status indicators */}
            <div className="flex items-center gap-1">
              {isValid && kitData?.modified_since_sync && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-accent-warning/15 text-accent-warning rounded border border-accent-warning/30">
                  Unsaved
                </span>
              )}
              {isValid &&
                kitData?.editable &&
                !kitData?.modified_since_sync && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-accent-success/15 text-accent-success rounded border border-accent-success/30">
                    Editable
                  </span>
                )}
              {/* Favorite toggle button */}
              {onToggleFavorite && (
                <button
                  className={`p-1 text-xs ml-1 transition-colors duration-150 ${
                    isFavorite
                      ? "text-accent-warning hover:brightness-110"
                      : "text-text-tertiary hover:text-accent-warning"
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
                  <Star
                    className={isFavorite ? "" : "opacity-30"}
                    size={16}
                    weight="fill"
                  />
                </button>
              )}
              {isValid && (
                <button
                  className="p-1 text-xs text-text-tertiary hover:text-accent-success ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  title="Duplicate kit"
                >
                  <Copy size={14} />
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
                    "bg-accent-danger/20 text-accent-danger border border-accent-danger/30";
                } else if (count === 12) {
                  color =
                    "bg-accent-success/30 text-accent-success border border-accent-success/40";
                  fontWeight = "font-bold";
                } else {
                  color =
                    "bg-accent-primary/20 text-accent-primary border border-accent-primary/30";
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

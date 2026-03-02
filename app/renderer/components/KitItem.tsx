import { Circle, Copy } from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";

interface KitItemProps extends BaseKitItemProps {}

// Add ref forwarding to support programmatic focus from KitList
const KitItem = React.memo(
  React.forwardRef<HTMLDivElement, KitItemProps & KitItemRenderProps>(
    (
      {
        isSelected,
        isValid,
        kit,
        kitData,
        onDuplicate,
        onSelect,
        sampleCounts,
        ...rest
      },
      ref,
    ) => {
      // Extract voice names using shared utility
      const voiceNames = extractVoiceNames(kitData);

      const { iconLabel, iconType } = useKitItem(voiceNames);

      // Use shared icon renderer
      const icon = <KitIconRenderer iconType={iconType} size="lg" />;
      // Add persistent selection highlight (independent of focus)
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

      // Add data-testid to root element for unambiguous test selection
      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`flex flex-col p-2 rounded border text-sm ${
            isValid
              ? "border-border-subtle hover:bg-surface-3"
              : "border-accent-danger bg-accent-danger/10"
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
          style={{ margin: 0 }}
          tabIndex={isSelected ? 0 : -1}
          {...rest}
        >
          {/* 2-column layout: icon | right content */}
          <div className="flex flex-row w-full h-full items-stretch">
            {/* Icon column */}
            <div className="flex items-center justify-center w-auto min-w-0 p-0 m-0 pr-2">
              <span
                className="block text-5xl"
                style={{ lineHeight: 1 }}
                title={iconLabel}
              >
                {icon}
              </span>
            </div>
            {/* Right column: 2 rows */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Top row: kit name, sample counts, copy button */}
              <div className="flex items-center w-full gap-2">
                <span
                  className={`font-mono truncate ${
                    isValid ? "text-text-primary" : "text-accent-danger"
                  }`}
                  style={{ flex: 1 }}
                >
                  {kit}
                </span>
                {isValid && kitData?.modified_since_sync && (
                  <div className="flex items-center gap-1 ml-2">
                    <Circle
                      className="text-accent-warning"
                      size={12}
                      weight="fill"
                    />
                    <span className="text-xs font-medium text-accent-warning">
                      Modified
                    </span>
                  </div>
                )}
                {isValid && sampleCounts && (
                  <span className="flex items-center gap-1 ml-2">
                    {sampleCounts.map((count, idx) => {
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
                      return (
                        <span
                          className={`px-1 rounded text-xs font-mono ${color} ${fontWeight}`}
                          key={`voice-${idx + 1}`}
                          title={`Voice ${idx + 1} samples`}
                        >
                          {count}
                        </span>
                      );
                    })}
                  </span>
                )}
                {isValid && (
                  <button
                    className="ml-2 p-1 text-xs text-text-tertiary hover:text-accent-success"
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
              {/* Bottom row: voice tags */}
              {isValid && voiceNames && (
                <div className="flex flex-wrap gap-1 mt-1 w-full min-h-[1.5rem] justify-end">
                  {Array.from(
                    new Set(Object.values(voiceNames).filter(Boolean)),
                  ).map((label, i) => (
                    <span
                      className="bg-accent-primary/15 text-accent-primary px-1 py-0.5 rounded-sm text-[10px] font-mono"
                      key={`voice-label-${label}-${i}`}
                    >
                      {typeof label === "string" ? toCapitalCase(label) : label}
                    </span>
                  ))}
                </div>
              )}
              {/* Search match indicators - compact badges */}
              {isValid && kitData?.searchMatch && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {kitData.searchMatch.matchedSamples.length > 0 && (
                    <span
                      className="px-1 py-0.5 text-xs bg-accent-success/15 text-accent-success rounded border border-accent-success/30 font-mono truncate cursor-help"
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
            </div>
          </div>
        </div>
      );
    },
  ),
);
KitItem.displayName = "KitItem";
export default KitItem;

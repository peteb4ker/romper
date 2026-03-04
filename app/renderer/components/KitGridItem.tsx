import { Copy, FileAudio, MusicNote, Star, Tag } from "@phosphor-icons/react";
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

type KitState = "editable" | "factory" | "invalid" | "modified";

const LED_STYLES: Record<
  KitState,
  { bg: string; border: string; dot: string }
> = {
  editable: {
    bg: "bg-surface-1",
    border: "border-border-subtle",
    dot: "bg-accent-success shadow-[0_0_4px_var(--accent-success)]",
  },
  factory: {
    bg: "bg-surface-1",
    border: "border-border-subtle",
    dot: "bg-text-tertiary opacity-40",
  },
  invalid: {
    bg: "bg-accent-danger/5 opacity-70",
    border: "border-accent-danger/40",
    dot: "bg-accent-danger shadow-[0_0_4px_var(--accent-danger)]",
  },
  modified: {
    bg: "bg-accent-warning/3",
    border: "border-accent-warning/40",
    dot: "bg-accent-warning shadow-[0_0_4px_var(--accent-warning)] animate-[led-pulse_2s_ease-in-out_infinite]",
  },
};

const getKitState = (
  isValid: boolean,
  kitData?: { editable?: boolean; modified_since_sync?: boolean } | null,
): KitState => {
  if (!isValid) return "invalid";
  if (kitData?.modified_since_sync) return "modified";
  if (kitData?.editable) return "editable";
  return "factory";
};

const getVoiceLedStyle = (count: number) => {
  if (count === 0) {
    return {
      dot: "bg-accent-danger shadow-[0_0_3px_var(--accent-danger)]",
      text: "text-accent-danger",
      weight: "",
    };
  }
  if (count === 12) {
    return {
      dot: "bg-accent-success shadow-[0_0_4px_var(--accent-success)]",
      text: "text-accent-success",
      weight: "font-bold",
    };
  }
  return {
    dot: "bg-accent-primary shadow-[0_0_3px_var(--accent-primary)]",
    text: "text-accent-primary",
    weight: "",
  };
};

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
      const voiceNames = extractVoiceNames(kitData);
      const { iconLabel, iconType } = useKitItem(voiceNames);
      const icon = <KitIconRenderer iconType={iconType} size="md" />;
      const isFavorite = isFavoriteProp ?? kitData?.is_favorite ?? false;
      const kitState = getKitState(isValid, kitData);
      const styles = LED_STYLES[kitState];

      const selectedHighlight = isSelected
        ? "ring-2 ring-accent-primary border-accent-primary bg-accent-primary/8"
        : "";

      const totalSamples =
        (sampleCounts?.[0] || 0) +
        (sampleCounts?.[1] || 0) +
        (sampleCounts?.[2] || 0) +
        (sampleCounts?.[3] || 0);
      const statusText = !isValid ? "Invalid kit" : `${totalSamples} samples`;
      const ariaLabel = `Kit ${kit} - ${statusText}`;

      return (
        <div
          aria-label={ariaLabel}
          aria-selected={isSelected ? "true" : "false"}
          className={`relative flex flex-col justify-between p-2 rounded-md border text-sm h-full w-full ${styles.border} ${styles.bg} ${
            kitState === "invalid" ? "cursor-not-allowed" : ""
          } cursor-pointer hover:bg-surface-2 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary ${selectedHighlight}`}
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
          {/* Top row: icon with LED, kit name, badges, actions */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Icon with state LED overlay */}
              <span className="relative" title={iconLabel}>
                {icon}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${styles.dot}`}
                  data-testid="state-led"
                />
              </span>
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className={`font-mono text-sm font-semibold tracking-wide truncate ${
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

            {/* MOD badge for modified state */}
            {kitState === "modified" && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-accent-warning bg-accent-warning/15 rounded border border-accent-warning/30"
                data-testid="mod-badge"
              >
                MOD
              </span>
            )}

            {/* Search match indicators */}
            {isValid && kitData?.searchMatch && (
              <div className="flex flex-wrap gap-1 ml-1">
                {kitData.searchMatch.matchedSamples.length > 0 && (
                  <span
                    className="px-1 py-0.5 text-xs bg-accent-success/15 text-accent-success rounded border border-accent-success/30 font-mono truncate max-w-full cursor-help inline-flex items-center gap-0.5"
                    title={`Sample matches:\n${kitData.searchMatch.matchedSamples.join("\n")}`}
                  >
                    <FileAudio data-testid="icon-file-audio" size={12} />
                    {kitData.searchMatch.matchedSamples.length > 1
                      ? ` ${kitData.searchMatch.matchedSamples.length}`
                      : ""}
                  </span>
                )}
                {kitData.searchMatch.matchedArtist && (
                  <span className="px-1 py-0.5 text-xs bg-voice-3-muted text-voice-3 rounded border border-voice-3/30 font-mono truncate inline-flex items-center gap-0.5">
                    <MusicNote data-testid="icon-music-note" size={12} />{" "}
                    {kitData.searchMatch.matchedArtist}
                  </span>
                )}
                {kitData.searchMatch.matchedAlias && (
                  <span className="px-1 py-0.5 text-xs bg-accent-primary/15 text-accent-primary rounded border border-accent-primary/30 font-mono truncate inline-flex items-center gap-0.5">
                    <Tag data-testid="icon-tag" size={12} />{" "}
                    {kitData.searchMatch.matchedAlias}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
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

          {/* Voice channel strip */}
          {isValid && sampleCounts && (
            <>
              <div className="border-t border-border-subtle mt-1.5 mb-1" />
              <div className="flex items-end gap-1 w-full">
                {sampleCounts.map((count, idx) => {
                  const voiceNumber = idx + 1;
                  const voiceName = voiceNames?.[voiceNumber];
                  const voiceDisplayName =
                    typeof voiceName === "string"
                      ? toCapitalCase(voiceName)
                      : voiceName;
                  const ledStyle = getVoiceLedStyle(count);

                  return (
                    <div
                      className="w-1/4 flex flex-col items-center gap-0.5"
                      key={`voice-${voiceNumber}`}
                      title={
                        `Voice ${voiceNumber}: ${count} samples` +
                        (voiceName ? ` (${voiceName})` : "")
                      }
                    >
                      {voiceDisplayName && (
                        <span className="text-[10px] text-text-secondary font-mono truncate w-full text-center">
                          {voiceDisplayName}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${ledStyle.dot}`}
                          data-testid={`voice-led-${voiceNumber}`}
                        />
                        <span
                          className={`text-xs font-mono ${ledStyle.text} ${ledStyle.weight}`}
                        >
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      );
    },
  ),
);

KitGridItem.displayName = "KitGridItem";
export default KitGridItem;

import {
  BookmarkSimple,
  Copy,
  LockSimple,
  MusicNote,
} from "@phosphor-icons/react";
import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

import { useKitItem } from "./hooks/kit-management/useKitItem";
import StereoIcon from "./icons/StereoIcon";
import { KitIconRenderer } from "./shared/KitIconRenderer";
import {
  BaseKitItemProps,
  extractVoiceNames,
  KitItemRenderProps,
} from "./shared/kitItemUtils";

interface KitGridItemProps extends BaseKitItemProps {}

const stripExtension = (filename: string) => filename.replace(/\.[^.]+$/, "");

/**
 * Highlights matched portions of text by wrapping them in a styled span.
 */
const highlightMatch = (
  text: string,
  term: string,
  markClass = "bg-accent-primary/25 text-accent-primary",
) => {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={`${markClass} font-semibold rounded-sm px-0.5`}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
};

const getVoiceCountStyle = (count: number) => {
  if (count === 0) {
    return { text: "text-accent-danger", weight: "" };
  }
  if (count === 12) {
    return { text: "text-accent-success", weight: "font-bold" };
  }
  return { text: "text-accent-primary", weight: "" };
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
          className={`card-grain relative flex flex-col p-2 rounded-md border text-sm h-full w-full ${
            !isValid
              ? "border-border-subtle opacity-70 cursor-not-allowed"
              : kitData?.modified_since_sync
                ? "border-accent-warning/40 bg-accent-warning/5"
                : "border-border-subtle"
          } cursor-pointer hover:bg-surface-2 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary`}
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
          {/* Top row: icon, kit name, status icons, actions */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span title={iconLabel}>{icon}</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  className={`font-mono text-[15px] font-semibold tracking-wide flex-shrink-0 ${
                    isValid ? "text-text-primary" : "text-accent-danger"
                  }`}
                >
                  {kit}
                </span>
                {isValid && !kitData?.editable && (
                  <span
                    className="flex-shrink-0"
                    data-testid="lock-icon"
                    title="Factory kit (read-only)"
                  >
                    <LockSimple
                      className="text-text-secondary"
                      size={15}
                      weight="bold"
                    />
                  </span>
                )}
                {kitData?.voices?.some((v) => v.stereo_mode) && (
                  <span
                    className={`flex-shrink-0 ${kitData?.searchMatch?.matchedOn?.includes("stereo") ? "text-accent-primary" : "text-text-tertiary"}`}
                    data-testid="stereo-indicator"
                    title="Has stereo-linked voices"
                  >
                    <StereoIcon size={15} />
                  </span>
                )}
                {kitData?.alias && (
                  <>
                    <span className="text-text-tertiary flex-shrink-0">·</span>
                    <span
                      className="text-[15px] text-text-secondary truncate"
                      title={`Kit alias: ${kitData.alias}`}
                    >
                      {kitData.searchMatch?.matchedAlias &&
                      kitData.searchMatch.searchTerm
                        ? highlightMatch(
                            kitData.alias,
                            kitData.searchMatch.searchTerm,
                          )
                        : kitData.alias}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Search match indicators (artist only — alias highlighted inline, samples shown in voice strip) */}
            {isValid && kitData?.searchMatch?.matchedArtist && (
              <div className="flex flex-wrap gap-1 ml-1">
                <span
                  className="px-1 py-0.5 text-xs bg-voice-3-muted text-voice-3 rounded border border-voice-3/30 font-mono truncate inline-flex items-center gap-0.5"
                  title={`Artist: ${kitData.searchMatch.matchedArtist}`}
                >
                  <MusicNote data-testid="icon-music-note" size={13} />{" "}
                  {kitData.searchMatch.matchedArtist}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
              {onToggleFavorite && (
                <button
                  className={`p-1 text-xs ml-1 transition-colors duration-150 ${
                    isFavorite
                      ? "text-accent-favorite hover:brightness-110"
                      : "text-text-tertiary hover:text-accent-favorite"
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
                  <BookmarkSimple
                    className={isFavorite ? "" : "opacity-30"}
                    size={17}
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
                  <Copy size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Voice channel strip */}
          {isValid &&
            sampleCounts &&
            totalSamples > 0 &&
            (() => {
              const matchesByVoice =
                kitData?.searchMatch?.matchedSamplesByVoice;
              const hasVoiceMatches =
                matchesByVoice && Object.keys(matchesByVoice).length > 0;

              return (
                <>
                  <div className="border-t border-border-subtle mt-1.5 mb-1" />
                  <div className="flex items-start gap-1 w-full">
                    {sampleCounts.map((count, idx) => {
                      const voiceNumber = idx + 1;
                      const voiceName = voiceNames?.[voiceNumber];
                      const voiceDisplayName =
                        typeof voiceName === "string"
                          ? toCapitalCase(voiceName)
                          : voiceName;
                      const countStyle = getVoiceCountStyle(count);
                      const voiceMatches = matchesByVoice?.[voiceNumber];
                      const hasMatches =
                        voiceMatches && voiceMatches.length > 0;
                      // Show "Voice N" fallback only when search matches are displayed
                      const displayLabel =
                        voiceDisplayName ||
                        (hasVoiceMatches ? `Voice ${voiceNumber}` : "\u00A0");

                      return (
                        <div
                          className={`w-1/4 flex flex-col items-center ${
                            hasVoiceMatches && !hasMatches
                              ? "opacity-30 justify-center"
                              : "gap-0.5"
                          }`}
                          key={`voice-${voiceNumber}`}
                          title={
                            `Voice ${voiceNumber}: ${count} samples` +
                            (voiceName ? ` (${voiceName})` : "")
                          }
                        >
                          <span className="text-[11px] text-text-secondary font-mono truncate w-full text-center">
                            {displayLabel}
                          </span>
                          {hasMatches ? (
                            <div
                              className="w-full overflow-hidden transition-all duration-300 ease-in-out"
                              data-testid={`voice-${voiceNumber}-matches`}
                              style={{
                                maxHeight: `${voiceMatches.length * 1.25 + 0.25}rem`,
                              }}
                            >
                              {voiceMatches.map((filename) => {
                                const stripped = stripExtension(filename);
                                const term = kitData?.searchMatch?.searchTerm;
                                return (
                                  <span
                                    className="block text-[10px] font-mono text-text-secondary truncate w-full text-center leading-tight"
                                    key={filename}
                                    title={filename}
                                  >
                                    {term
                                      ? highlightMatch(
                                          stripped,
                                          term,
                                          "bg-accent-success/25 text-accent-success",
                                        )
                                      : stripped}
                                  </span>
                                );
                              })}
                            </div>
                          ) : hasVoiceMatches ? null : (
                            <span
                              className={`text-[13px] font-mono ${countStyle.text} ${countStyle.weight}`}
                            >
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

          {/* Voice names row — shown when voices have names but no samples to display them in */}
          {isValid &&
            (!sampleCounts || totalSamples === 0) &&
            voiceNames &&
            Object.keys(voiceNames).length > 0 && (
              <>
                <div className="border-t border-border-subtle mt-1.5 mb-1" />
                <div className="flex items-center gap-1 flex-wrap">
                  {Object.entries(voiceNames).map(([voiceNum, name]) => (
                    <span
                      className="text-[11px] text-text-secondary font-mono truncate"
                      key={`voice-name-${voiceNum}`}
                    >
                      {typeof name === "string" ? toCapitalCase(name) : name}
                    </span>
                  ))}
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

import { toCapitalCase } from "@romper/shared/kitUtilsShared";
import React from "react";

import type { KitWithSearchMatch } from "./shared/kitItemUtils";

import { highlightMatch, stripExtension } from "./shared/searchHighlight";

interface KitVoiceStripProps {
  kitData?: KitWithSearchMatch | null;
  sampleCounts: [number, number, number, number];
  voiceNames?: Record<number | string, string>;
}

const getVoiceCountStyle = (count: number) => {
  if (count === 0) {
    return { text: "text-accent-danger", weight: "" };
  }
  if (count === 12) {
    return { text: "text-accent-success", weight: "font-bold" };
  }
  return { text: "text-accent-primary", weight: "" };
};

/**
 * The four-voice channel strip at the bottom of a kit grid item: per-voice
 * name and sample count, replaced by matching sample filenames (with the
 * search term highlighted) when a sample search is active.
 */
export const KitVoiceStrip: React.FC<KitVoiceStripProps> = ({
  kitData,
  sampleCounts,
  voiceNames,
}) => {
  const matchesByVoice = kitData?.searchMatch?.matchedSamplesByVoice;
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
          const hasMatches = voiceMatches && voiceMatches.length > 0;
          const displayLabel =
            voiceDisplayName ||
            (hasVoiceMatches ? `Voice ${voiceNumber}` : " ");
          const countCell = hasVoiceMatches ? null : (
            <span
              className={`text-[13px] font-mono ${countStyle.text} ${countStyle.weight}`}
            >
              {count}
            </span>
          );

          return (
            <div
              className={`w-1/4 flex flex-col items-center ${
                hasVoiceMatches && !hasMatches
                  ? "opacity-30 justify-center"
                  : "gap-0.5"
              }`}
              // sampleCounts is a fixed 4-tuple; voiceNumber
              // (= idx + 1) is the semantic voice id, not an
              // arbitrary index. NOSONAR suppresses S6479.
              key={`voice-${voiceNumber}`} // NOSONAR
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
              ) : (
                countCell
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

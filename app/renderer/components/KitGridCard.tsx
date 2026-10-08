import type { Kit, KitWithRelations } from "@romper/shared/db/schema.js";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import React, { useCallback } from "react";

import type { KitWithSearchMatch } from "./shared/kitItemUtils";

import KitGridItem from "./KitGridItem";

interface KitGridCardProps {
  focusedIdx: null | number;
  isNew?: boolean;
  kit: Kit;
  kitData?: KitWithRelations[] | null;
  kitsToDisplay: Kit[];
  onDelete?: (kitName: string) => void;
  onDeleteKit?: (kitName: string) => Promise<void>;
  onDuplicate: (kitName: string) => void;
  onDuplicateKit?: (
    source: string,
    dest: string,
  ) => Promise<{ error?: string }>;
  onFocusKit?: (kitName: string) => void;
  onRequestDeleteSummary?: (
    kitName: string,
  ) => Promise<{ locked: boolean; sampleCount: number } | null>;
  onSelectKit: (kitName: string) => void;
  onToggleFavorite?: (kitName: string) => void;
  sampleCounts?: Record<string, [number, number, number, number]>;
  setFocus: (index: number) => void;
}

const CARD_HEIGHT = 104;

function hasSearchSampleMatches(
  kitDataItem: KitWithSearchMatch | null,
): boolean {
  const byVoice = kitDataItem?.searchMatch?.matchedSamplesByVoice;
  return !!byVoice && Object.keys(byVoice).length > 0;
}

// Memoized, and its handlers are stable, so the card under it (also
// memoized) renders only when what it shows changes (#462)
export const KitGridCard = React.memo(function KitGridCard({
  focusedIdx,
  isNew,
  kit,
  kitData,
  kitsToDisplay,
  onDelete,
  onDeleteKit,
  onDuplicate,
  onDuplicateKit,
  onFocusKit,
  onRequestDeleteSummary,
  onSelectKit,
  onToggleFavorite,
  sampleCounts,
  setFocus,
}: KitGridCardProps) {
  const globalIndex = kitsToDisplay.findIndex((k) => k.name === kit.name);
  const isValid = isValidKit(kit.name);
  const isSelected = focusedIdx === globalIndex;
  const kitDataItem = kitData?.find((k) => k.name === kit.name) ?? null;

  // The kit list is the one source of favourite state (RE-37)
  const isFavorite = kitDataItem?.is_favorite ?? kit.is_favorite;

  const kitName = kit.name;
  const handleSelectKit = useCallback(() => {
    if (isValid) {
      onSelectKit(kitName);
      if (onFocusKit) onFocusKit(kitName);
      setFocus(globalIndex);
    }
  }, [globalIndex, isValid, kitName, onFocusKit, onSelectKit, setFocus]);

  const handleDelete = useCallback(() => {
    if (isValid) onDelete?.(kitName);
  }, [isValid, kitName, onDelete]);

  const handleDuplicate = useCallback(() => {
    if (isValid) onDuplicate(kitName);
  }, [isValid, kitName, onDuplicate]);

  const expanded = hasSearchSampleMatches(kitDataItem);

  return (
    <div
      key={kit.name}
      style={expanded ? { minHeight: CARD_HEIGHT } : { height: CARD_HEIGHT }}
    >
      <KitGridItem
        data-kit={kit.name}
        data-testid={`kit-item-${kit.name}`}
        isFavorite={isFavorite}
        isNew={isNew}
        isSelected={isSelected}
        isValid={isValid}
        kit={kit.name}
        kitData={kitDataItem}
        onDelete={onDelete ? handleDelete : undefined}
        onDeleteKit={onDeleteKit}
        onDuplicate={handleDuplicate}
        onDuplicateKit={onDuplicateKit}
        onRequestDeleteSummary={onRequestDeleteSummary}
        onSelect={handleSelectKit}
        onToggleFavorite={onToggleFavorite}
        sampleCounts={sampleCounts ? sampleCounts[kit.name] : undefined}
      />
    </div>
  );
});

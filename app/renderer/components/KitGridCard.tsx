import type { Kit, KitWithRelations } from "@romper/shared/db/schema.js";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import React from "react";

import type { KitWithSearchMatch } from "./shared/kitItemUtils";

import KitGridItem from "./KitGridItem";

interface KitGridCardProps {
  focusedIdx: null | number;
  getKitFavoriteState?: (kitName: string) => boolean;
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

function hasSearchSampleMatches(kitDataItem: KitWithRelations | null): boolean {
  const k = kitDataItem as KitWithSearchMatch | null;
  const byVoice = k?.searchMatch?.matchedSamplesByVoice;
  return !!byVoice && Object.keys(byVoice).length > 0;
}

export const KitGridCard: React.FC<KitGridCardProps> = ({
  focusedIdx,
  getKitFavoriteState,
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
}) => {
  const globalIndex = kitsToDisplay.findIndex((k) => k.name === kit.name);
  const isValid = isValidKit(kit.name);
  const isSelected = focusedIdx === globalIndex;
  const kitDataItem = kitData?.find((k) => k.name === kit.name) ?? null;

  const isFavorite = getKitFavoriteState
    ? getKitFavoriteState(kit.name)
    : kitDataItem?.is_favorite;

  const handleSelectKit = () => {
    if (isValid) {
      onSelectKit(kit.name);
      if (onFocusKit) onFocusKit(kit.name);
      setFocus(globalIndex);
    }
  };

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
        isSelected={isSelected}
        isValid={isValid}
        kit={kit.name}
        kitData={kitDataItem}
        onDelete={onDelete ? () => isValid && onDelete(kit.name) : undefined}
        onDeleteKit={onDeleteKit}
        onDuplicate={() => isValid && onDuplicate(kit.name)}
        onDuplicateKit={onDuplicateKit}
        onRequestDeleteSummary={onRequestDeleteSummary}
        onSelect={handleSelectKit}
        onToggleFavorite={onToggleFavorite}
        sampleCounts={sampleCounts ? sampleCounts[kit.name] : undefined}
      />
    </div>
  );
};

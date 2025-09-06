import type { Kit, KitWithRelations } from "@romper/shared/db/schema.js";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import React from "react";

import KitGridItem from "./KitGridItem";

interface KitGridCardProps {
  focusedIdx: null | number;
  getKitFavoriteState?: (kitName: string) => boolean;
  kit: Kit;
  kitData?: KitWithRelations[] | null;
  kitsToDisplay: Kit[];
  onDuplicate: (kitName: string) => void;
  onFocusKit?: (kitName: string) => void;
  onSelectKit: (kitName: string) => void;
  onToggleFavorite?: (kitName: string) => void;
  sampleCounts?: Record<string, [number, number, number, number]>;
  setFocus: (index: number) => void;
}

const CARD_HEIGHT = 90;

export const KitGridCard: React.FC<KitGridCardProps> = ({
  focusedIdx,
  getKitFavoriteState,
  kit,
  kitData,
  kitsToDisplay,
  onDuplicate,
  onFocusKit,
  onSelectKit,
  onToggleFavorite,
  sampleCounts,
  setFocus,
}) => {
  const globalIndex = kitsToDisplay.findIndex((k) => k.name === kit.name);
  const isValid = isValidKit(kit.name);
  const isSelected = focusedIdx === globalIndex;
  const kitDataItem = kitData?.find((k) => k.name === kit.name) ?? null;

  // Compute the favorite state for this kit
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

  return (
    <div key={kit.name} style={{ height: CARD_HEIGHT }}>
      <KitGridItem
        data-kit={kit.name}
        data-testid={`kit-item-${kit.name}`}
        isFavorite={isFavorite}
        isSelected={isSelected}
        isValid={isValid}
        kit={kit.name}
        kitData={kitDataItem}
        onDuplicate={() => isValid && onDuplicate(kit.name)}
        onSelect={handleSelectKit}
        onToggleFavorite={onToggleFavorite}
        sampleCounts={sampleCounts ? sampleCounts[kit.name] : undefined}
      />
    </div>
  );
};

import type { KitWithRelations } from "@romper/shared/db/schema";

/**
 * Common interface for kit item props
 */
export interface BaseKitItemProps {
  isFavorite?: boolean; // Direct boolean value instead of function
  isValid: boolean;
  kit: string;
  kitData?: KitWithRelations | null;
  onDuplicate: () => void;
  onSelect: () => void;
  onToggleFavorite?: (kitName: string) => void;
  sampleCounts?: [number, number, number, number];
}

/**
 * Common interface for kit item selection and data attributes
 */
export interface KitItemRenderProps {
  "data-kit"?: string;
  isSelected?: boolean;
}

/**
 * Extracts voice names from kit data into a lookup map
 * Reduces duplication between KitItem and KitGridItem components
 */
export function extractVoiceNames(
  kitData?: KitWithRelations | null
): Record<number | string, string> | undefined {
  return kitData?.voices
    ? Object.fromEntries(
        kitData.voices
          .filter((v) => v.voice_alias !== null)
          .map((v) => [v.voice_number, v.voice_alias!])
      )
    : undefined;
}

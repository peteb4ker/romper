import type { KitWithRelations } from "../../../../shared/db/schema";

/**
 * Extracts voice names from kit data into a lookup map
 * Reduces duplication between KitItem and KitGridItem components
 */
export function extractVoiceNames(
  kitData?: KitWithRelations | null,
): Record<string | number, string> | undefined {
  return kitData?.voices
    ? Object.fromEntries(
        kitData.voices
          .filter((v) => v.voice_alias !== null)
          .map((v) => [v.voice_number, v.voice_alias!]),
      )
    : undefined;
}

/**
 * Common interface for kit item props
 */
export interface BaseKitItemProps {
  kit: string;
  isValid: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  sampleCounts?: [number, number, number, number];
  kitData?: KitWithRelations | null;
}

/**
 * Common interface for kit item selection and data attributes
 */
export interface KitItemRenderProps {
  "data-kit"?: string;
  isSelected?: boolean;
}

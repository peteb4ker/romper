// kitTypes.ts
// Central location for all UI TypeScript interfaces/types for kits

import type { KitWithRelations } from "../../../shared/db/schema";
import type { AnyUndoAction } from "../../../shared/undoTypes";

export interface KitDetailsProps {
  kitIndex?: number;
  kitName: string;
  kits?: KitWithRelations[];
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onBack: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  onRequestSamplesReload?: () => Promise<void>;
  samples?: null | VoiceSamples;
}

export interface KitSamplePlanSlot {
  meta?: Record<string, any>;
  source: string;
  target: string;
  voice: number; // 1-4
  voiceType?: string;
}

export interface SampleData {
  [key: string]: any;
  filename: string;
  is_stereo?: boolean;
  source_path: string;
}

export interface VoiceSamples {
  [voice: number]: string[];
}
